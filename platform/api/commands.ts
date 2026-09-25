import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {SupabaseClient} from '@supabase/supabase-js';
import {commandSchema,type Command,type CommandResult,type Entity,type EntityKind} from '../../packages/contracts/index';
import {DomainError,requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';
import {verifyStoredFile} from '../shared/files';
import {loadEntity,publishChange,toEntity,updateStatus,TABLES} from './entities';
import {validatePlanning} from '../../modules/planning/validator';
import {validateVoucher} from '../../modules/vouchers/validator';

export const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
export const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
async function requireOwner(db:PoolClient,org:string,trip:string){const r=await db.query('select ouranos.can_edit_trip($1,$2) as allowed',[org,trip]);check(r.rows[0].allowed,'PERMISSION_DENIED','Only the traveler may edit or submit this trip',403)}
async function verifyVersion(row:Record<string,any>|undefined,expected:number){if((row?.version||0)!==expected)throw new DomainError('VERSION_CONFLICT','This record changed. Review the current server version before retrying.',409,{serverVersion:row?.version||0})}
async function enqueue(db:PoolClient,type:string,org:string,entityId:string,key:string){await db.query('select ouranos.enqueue_job($1)',[JSON.stringify({type,organizationId:org,entityId,jobKey:key})])}
async function audit(db:PoolClient,c:Command,userId:string,e:Entity){await db.query('insert into public.audit_events(organization_id,trip_id,actor_id,command_id,action,entity_id,details) values($1,$2,$3,$4,$5,$6,$7)',[c.organizationId,e.tripId||(e.kind==='trip'?e.id:null),userId,c.commandId,c.type,e.id,JSON.stringify({version:e.version})])}
async function notify(db:PoolClient,org:string,trip:string,userId:string,title:string,requestId:string){
 const id=randomUUID();const data={title,requestId,recipientId:userId};
 await db.query("insert into public.notifications(id,organization_id,trip_id,user_id,data) values($1,$2,$3,$4,$5)",[id,org,trip,userId,data]);
 await publishChange(db,'notification',{id,organization_id:org,trip_id:trip,data,status:'unread',version:1,updated_at:new Date()});
}

export async function executeCommand(pool:Pool,storage:SupabaseClient,userId:string,input:unknown,development:boolean):Promise<CommandResult>{
 const c=commandSchema.parse(input);
 try{return await withActor(pool,userId,c.organizationId,async db=>{
  const role=(await db.query('select ouranos.member_role($1) as role',[c.organizationId])).rows[0].role;
  check(role,'PERMISSION_DENIED','Organization membership is required',403);
  const prior=(await db.query('select * from public.processed_commands where organization_id=$1 and command_id=$2',[c.organizationId,c.commandId])).rows[0];
  if(prior){check(prior.payload_hash===hash(c),'IDEMPOTENCY_CONFLICT','Command ID was reused with different content',409);return {...prior.result,replayed:true}}
  await db.query('insert into public.devices(id,organization_id,user_id) values($1,$2,$3) on conflict(organization_id,id) do update set last_seen_at=now()',[c.deviceId,c.organizationId,userId]);
  const entity=await apply(db,storage,c,userId,role,development);
  const result:CommandResult={commandId:c.commandId,ok:true,entity};
  await audit(db,c,userId,entity);
  await db.query('insert into public.processed_commands(organization_id,user_id,command_id,payload_hash,result) values($1,$2,$3,$4,$5)',[c.organizationId,userId,c.commandId,hash(c),JSON.stringify(result)]);
  return result;
 })}catch(error){if(error instanceof DomainError)return {commandId:c.commandId,ok:false,error:{code:error.code,message:error.message,details:error.details}};throw error}
}

async function apply(db:PoolClient,storage:SupabaseClient,c:Command,userId:string,role:string,development:boolean):Promise<Entity>{
 const org=c.organizationId,id=c.entityId;
 if(c.type==='trip.save'){
  const current=(await db.query('select * from public.trips where organization_id=$1 and id=$2 for update',[org,id])).rows[0];
  await verifyVersion(current,c.expectedVersion);
  if(current){await requireOwner(db,org,id);const submitted=await db.query("select 1 from public.authorizations where trip_id=$1 and organization_id=$2 and status in ('in_review','approved')",[id,org]);check(!submitted.rowCount,'INVALID_STATE_TRANSITION','This trip has a submitted authorization. Use an amendment workflow to change it.',409)}
  const r=current?await db.query('update public.trips set data=$3,version=version+1,updated_at=now() where organization_id=$1 and id=$2 returning *',[org,id,c.payload]):await db.query('insert into public.trips(id,organization_id,traveler_id,created_by,data) values($1,$2,$3,$3,$4) returning *',[id,org,userId,c.payload]);
  return publishChange(db,'trip',r.rows[0]);
 }
 if(c.type==='authorization.save'||c.type==='expense.save'||c.type==='voucher.save'){
  const kind=c.type.split('.')[0] as 'authorization'|'expense'|'voucher';const payload=c.payload;
  await requireOwner(db,org,payload.tripId);
  const current=(await db.query(`select * from public.${TABLES[kind]} where organization_id=$1 and id=$2 for update`,[org,id])).rows[0];await verifyVersion(current,c.expectedVersion);
  if(current){check(current.trip_id===payload.tripId,'VALIDATION_FAILED','Cannot move records between trips');check(['draft','changes_requested'].includes(current.status),'INVALID_STATE_TRANSITION','Create a new amendment or revision instead of changing submitted content',409)}
  if(c.type==='expense.save'){
   for(const docId of c.payload.documentIds){const d=await loadEntity(db,'document',docId,org);check(d.trip_id===payload.tripId,'VALIDATION_FAILED','Receipt belongs to another trip')}
  }
  if(c.type==='voucher.save'){
   const a=await loadEntity(db,'authorization',c.payload.authorizationId,org);check(a.trip_id===payload.tripId,'VALIDATION_FAILED','Authorization belongs to another trip');
   for(const eid of c.payload.expenseIds){const e=await loadEntity(db,'expense',eid,org);check(e.trip_id===payload.tripId,'VALIDATION_FAILED','Expense belongs to another trip')}
  }
  const r=current?await db.query(`update public.${TABLES[kind]} set data=$3,version=version+1,status='draft',updated_at=now()${kind==='voucher'?',authorization_id=$4':''} where organization_id=$1 and id=$2 returning *`,kind==='voucher'?[org,id,payload,(c.payload as any).authorizationId]:[org,id,payload]):await db.query(`insert into public.${TABLES[kind]}(id,organization_id,trip_id,data,created_by${kind==='voucher'?',authorization_id':''}) values($1,$2,$3,$4,$5${kind==='voucher'?',$6':''}) returning *`,kind==='voucher'?[id,org,payload.tripId,payload,userId,(c.payload as any).authorizationId]:[id,org,payload.tripId,payload,userId]);
  if(c.type==='expense.save'){
   await db.query('delete from public.document_links where organization_id=$1 and expense_id=$2',[org,id]);
   for(const docId of c.payload.documentIds)await db.query('insert into public.document_links(organization_id,document_id,expense_id) values($1,$2,$3)',[org,docId,id]);
  }
  return publishChange(db,kind,r.rows[0]);
 }
 if(c.type==='document.register'){
  check(c.expectedVersion===0,'VERSION_CONFLICT','Document registration requires version zero',409);await requireOwner(db,org,c.payload.tripId);
  const r=await db.query('insert into public.documents(id,organization_id,trip_id,data,storage_key,created_by) values($1,$2,$3,$4,$5,$6) returning *',[id,org,c.payload.tripId,c.payload,`${org}/${c.payload.tripId}/${id}/original`,userId]);
  return publishChange(db,'document',r.rows[0]);
 }
 if(c.type==='document.finalize'||c.type==='document.confirm'||c.type==='document.reprocess'){
  const d=await loadEntity(db,'document',id,org,true);await verifyVersion(d,c.expectedVersion);await requireOwner(db,org,d.trip_id);
  if(c.type==='document.reprocess'){check(['awaiting_provider','failed'].includes(d.status),'INVALID_STATE_TRANSITION','Only blocked or failed processing can be retried',409);const e=await updateStatus(db,'document',id,org,'uploaded');await enqueue(db,'receipt.process',org,id,`receipt:${id}:${e.version}`);return e;}
  if(c.type==='document.confirm'){check(d.status==='needs_review','INVALID_STATE_TRANSITION','Document is not ready for confirmation',409);return updateStatus(db,'document',id,org,'ready')}
  check(d.status==='registered','INVALID_STATE_TRANSITION','Document upload already finalized',409);
  await verifyStoredFile(storage,d);
  const e=await updateStatus(db,'document',id,org,'uploaded');await enqueue(db,'receipt.process',org,id,`receipt:${id}:${e.version}`);return e;
 }
 if(c.type==='workflow.configure'){
  check(role==='admin','PERMISSION_DENIED','Only organization admins configure routing',403);
  const current=(await db.query('select * from public.workflow_definitions where organization_id=$1 and id=$2 for update',[org,id])).rows[0];await verifyVersion(current,c.expectedVersion);
  for(const step of c.payload.steps){const member=(await db.query('select role from public.memberships where organization_id=$1 and user_id=$2 and active',[org,step.assigneeId])).rows[0];check(member?.role===step.role,'VALIDATION_FAILED','Each assignee must have the required role')}
  const r=current?await db.query('update public.workflow_definitions set data=$3,kind=$4,version=version+1,updated_at=now() where organization_id=$1 and id=$2 returning *',[org,id,c.payload,c.payload.kind]):await db.query('insert into public.workflow_definitions(id,organization_id,kind,data,created_by) values($1,$2,$3,$4,$5) returning *',[id,org,c.payload.kind,c.payload,userId]);return publishChange(db,'workflow',r.rows[0]);
 }
 if(c.type==='authorization.submit'||c.type==='voucher.submit')return submit(db,c,userId,development);
 if(c.type==='approval.decide')return decide(db,c,userId,role);
 if(c.type==='notification.read'){
  const n=await loadEntity(db,'notification',id,org,true);await verifyVersion(n,c.expectedVersion);return updateStatus(db,'notification',id,org,'read');
 }
 if(c.type==='integration.request'){
  const e=await loadEntity(db,c.payload.kind,id,org);await verifyVersion(e,c.expectedVersion);await requireOwner(db,org,e.trip_id);check(e.status==='approved','INVALID_STATE_TRANSITION','Only approved revisions can be delivered',409);
  const key=c.payload.kind==='authorization'?'authorization_id':'voucher_id';
  const rev=(await db.query(`select r.* from public.submission_revisions r join public.approval_requests a on a.revision_id=r.id where r.organization_id=$1 and r.${key}=$2 and a.status='approved' order by r.created_at desc limit 1`,[org,id])).rows[0];check(rev,'INVALID_STATE_TRANSITION','Approved revision missing',409);
  let row=(await db.query('select * from public.integration_deliveries where revision_id=$1',[rev.id])).rows[0];
  if(!row)row=(await db.query('insert into public.integration_deliveries(organization_id,trip_id,revision_id,data,created_by) values($1,$2,$3,$4,$5) returning *',[org,e.trip_id,rev.id,{kind:c.payload.kind,entityId:id,revisionId:rev.id},userId])).rows[0];
  await enqueue(db,'dts.deliver',org,row.id,`dts:${row.id}`);return publishChange(db,'integration',row);
 }
 throw new DomainError('VALIDATION_FAILED','Unsupported command');
}

async function submit(db:PoolClient,c:Extract<Command,{type:'authorization.submit'|'voucher.submit'}>,userId:string,development:boolean){
 const kind=c.type.split('.')[0] as 'authorization'|'voucher',org=c.organizationId;
 const entity=await loadEntity(db,kind,c.entityId,org,true);await verifyVersion(entity,c.expectedVersion);await requireOwner(db,org,entity.trip_id);check(['draft','changes_requested'].includes(entity.status),'INVALID_STATE_TRANSITION','This revision has already been submitted',409);
 const issues=(kind==='authorization'?validatePlanning:validateVoucher)(entity.data.formSchemaVersion,entity.data.formData,development);check(!issues.length,'VALIDATION_FAILED',issues.join('; '));
 const workflow=(await db.query("select * from public.workflow_definitions where organization_id=$1 and kind=$2 and status='active'",[org,kind])).rows[0];check(workflow,'DEPENDENCY_PENDING','An administrator must configure approval routing',409);
 check(workflow.data.steps.every((s:any)=>s.assigneeId!==userId),'PERMISSION_DENIED','A traveler cannot review their own submission',403);
 const trip=await loadEntity(db,'trip',entity.trip_id,org);const snapshot:Record<string,any>={kind,entity:toEntity(kind,entity),trip:toEntity('trip',trip),workflow:workflow.data,workflowVersion:workflow.version};
 if(kind==='voucher'){
  const auth=await loadEntity(db,'authorization',entity.authorization_id,org);check(auth.status==='approved','INVALID_STATE_TRANSITION','An approved authorization is required',409);
  snapshot.authorization=toEntity('authorization',auth);snapshot.expenses=[];snapshot.documents=[];
  for(const expenseId of entity.data.expenseIds){const expense=await loadEntity(db,'expense',expenseId,org);check(expense.trip_id===entity.trip_id,'VALIDATION_FAILED','Expense trip mismatch');snapshot.expenses.push(toEntity('expense',expense));
   for(const docId of expense.data.documentIds){const doc=await loadEntity(db,'document',docId,org);check(doc.trip_id===entity.trip_id&&doc.status==='ready','ATTACHMENT_INCOMPLETE','A receipt is not processed and confirmed',409);snapshot.documents.push(toEntity('document',doc))}
  }
 }
 const rev=(await db.query('insert into public.submission_revisions(organization_id,trip_id,authorization_id,voucher_id,entity_version,snapshot,sha256,submitted_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[org,entity.trip_id,kind==='authorization'?entity.id:null,kind==='voucher'?entity.id:null,entity.version,snapshot,hash(snapshot),userId])).rows[0];
 const req=(await db.query('insert into public.approval_requests(organization_id,trip_id,revision_id,workflow_id,workflow_version,data,created_by) values($1,$2,$3,$4,$5,$6,$7) returning *',[org,entity.trip_id,rev.id,workflow.id,workflow.version,{kind,entityId:entity.id,revisionId:rev.id},userId])).rows[0];
 for(const [i,step] of workflow.data.steps.entries())await db.query('insert into public.approval_steps(organization_id,request_id,position,assignee_id,required_role) values($1,$2,$3,$4,$5)',[org,req.id,i,step.assigneeId,step.role]);
 await notify(db,org,entity.trip_id,workflow.data.steps[0].assigneeId,'A travel submission needs review',req.id);await publishChange(db,'approval',req);return updateStatus(db,kind,entity.id,org,'in_review');
}
async function decide(db:PoolClient,c:Extract<Command,{type:'approval.decide'}>,userId:string,role:string){
 const req=await loadEntity(db,'approval',c.entityId,c.organizationId,true);await verifyVersion(req,c.expectedVersion);check(req.status==='in_review','INVALID_STATE_TRANSITION','This request is no longer in review',409);check(req.created_by!==userId,'PERMISSION_DENIED','Self-approval is not permitted',403);
 const step=(await db.query("select * from public.approval_steps where request_id=$1 and status='pending' order by position limit 1 for update",[req.id])).rows[0];check(step?.assignee_id===userId&&step.required_role===role,'PERMISSION_DENIED','You are not the current assigned reviewer',403);
 await db.query('insert into public.approval_decisions(organization_id,request_id,step_id,actor_id,decision,comment) values($1,$2,$3,$4,$5,$6)',[c.organizationId,req.id,step.id,userId,c.payload.decision,c.payload.comment]);
 await db.query('update public.approval_steps set status=$2 where id=$1',[step.id,c.payload.decision]);
 const next=(await db.query("select * from public.approval_steps where request_id=$1 and status='pending' order by position limit 1",[req.id])).rows[0];
 const status=c.payload.decision==='approved'&&next?'in_review':c.payload.decision;
 if(status!=='in_review')await updateStatus(db,req.data.kind,req.data.entityId,c.organizationId,status);
 await notify(db,c.organizationId,req.trip_id,status==='in_review'?next.assignee_id:req.created_by,status==='in_review'?'A travel submission needs review':`Submission ${status.replaceAll('_',' ')}`,req.id);
 return updateStatus(db,'approval',req.id,c.organizationId,status);
}
