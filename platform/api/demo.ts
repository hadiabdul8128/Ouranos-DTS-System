import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {approvalLevelsOf,approvalUpdateNotice} from '../../packages/contracts/approval-chain';
import {DEMO_APPROVAL_COMMENT,demoApproveInput} from '../../packages/contracts/demo';
import {requireCondition as check} from '../../packages/domain/errors';
import type {PlatformConfig} from '../shared/config';
import {withActor} from '../shared/database';
import {notify,requireOwner} from './commands';
import {loadEntity,updateStatus} from './entities';

/** Lets a traveler skip the wait for approvers while showing the product, only in workspaces listed in DEMO_APPROVAL_ORGANIZATIONS. Every step is recorded and audited as a demo approval. */
export function registerDemoRoutes(app:FastifyInstance,pool:Pool,config:PlatformConfig){
 app.post('/v1/demo/approve',async req=>{
  const b=demoApproveInput.parse(req.body);
  check(config.DEMO_APPROVAL_ORGANIZATIONS.includes(b.organizationId),'PERMISSION_DENIED','Demo approval is turned off for this workspace',403);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   const auth=await loadEntity(db,'authorization',b.authorizationId,b.organizationId,true);
   await requireOwner(db,b.organizationId,auth.trip_id);
   check(auth.status==='in_review','INVALID_STATE_TRANSITION','Submit the plan for review first',409);
   const request=(await db.query("select * from ouranos.approval_requests where organization_id=$1 and data->>'entityId'=$2 and status='in_review' order by created_at desc limit 1 for update",[b.organizationId,auth.id])).rows[0];
   const decidedAt=new Date().toISOString();
   if(request){
    const steps=(await db.query("select * from ouranos.approval_steps where request_id=$1 and status='pending' order by position for update",[request.id])).rows;
    for(const step of steps){
     await db.query('insert into ouranos.approval_decisions(organization_id,request_id,step_id,actor_id,decision,comment) values($1,$2,$3,$4,$5,$6)',[b.organizationId,request.id,step.id,req.actor.id,'approved',DEMO_APPROVAL_COMMENT]);
     await db.query("update ouranos.approval_steps set status='approved' where id=$1",[step.id]);
    }
    const levels=approvalLevelsOf({status:request.status,data:request.data}).map(level=>level.status==='approved'?level:{...level,status:'approved' as const,decidedAt,comment:DEMO_APPROVAL_COMMENT});
    if(Array.isArray(request.data.levels))await db.query('update ouranos.approval_requests set data=$2 where id=$1',[request.id,{...request.data,levels}]);
    await updateStatus(db,'approval',request.id,b.organizationId,'approved');
    const last=levels[levels.length-1]!;
    await notify(db,b.organizationId,auth.trip_id,req.actor.id,'',request.id,approvalUpdateNotice({recipientId:req.actor.id,requestId:request.id,tripId:auth.trip_id,entityKind:'authorization',entityId:auth.id,...(typeof request.data.destination==='string'?{destination:request.data.destination}:{}),level:{position:last.position,label:last.label},decision:'approved',comment:DEMO_APPROVAL_COMMENT,decidedAt}));
   }
   const approved=await updateStatus(db,'authorization',auth.id,b.organizationId,'approved');
   await db.query('insert into ouranos.audit_events(organization_id,trip_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5,$6)',[b.organizationId,auth.trip_id,req.actor.id,'approval.demo_approved',auth.id,JSON.stringify({requestId:request?.id??null})]);
   return {entity:approved};
  });
 });
}
