import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import type {Command,CommandType,Entity,PayloadOf} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION,type PlanningModuleInput} from '../../packages/contracts/planning-module';
import {VOUCHER_MODULE_SCHEMA_VERSION,type VoucherModuleInput} from '../../packages/contracts/voucher-module';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL]){
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname)){
  throw new Error('Connected travel integration tests require loopback Supabase and Postgres endpoints');
 }
}

type TestUser='traveler'|'reviewer'|'approver'|'peer'|'outsider';
const users={} as Record<TestUser,{id:string;token:string;deviceId:string}>;
const tripId=crypto.randomUUID(),authorizationId=crypto.randomUUID(),itemId=crypto.randomUUID();
const planning:PlanningModuleInput={
 traveler:'Connected Flow Traveler',origin:'Norfolk, VA',currency:'USD',
 approvedExpenseItems:[{id:itemId,category:'meals',description:'Travel-day meal',authorizedAmountMinor:2500,expectedPaymentMethod:'personal',date:'2026-10-12'}],
};
let app:Awaited<ReturnType<typeof buildApp>>,pool:Pool,organizationId:string;

async function request(user:TestUser,method:'GET'|'POST'|'PUT',url:string,payload?:unknown){
 const response=await app.inject({method,url,headers:{authorization:`Bearer ${users[user].token}`},payload:payload as object});
 return {status:response.statusCode,body:response.json()};
}
async function send<T extends CommandType>(user:TestUser,type:T,entityId:string,expectedVersion:number,payload:PayloadOf<T>){
 const command={type,entityId,expectedVersion,payload,organizationId,commandId:crypto.randomUUID(),deviceId:users[user].deviceId,schemaVersion:1} as Command;
 return request(user,'POST','/v1/commands',command);
}
function expectSuccess(result:{status:number;body:any}){
 expect(result.status,JSON.stringify(result.body)).toBe(200);
 expect(result.body.ok,JSON.stringify(result.body)).toBe(true);
 return result.body.entity as Entity;
}
async function approvalFor(entityId:string){
 const list=await request('reviewer','GET',`/v1/entities/approval?organizationId=${organizationId}`);
 expect(list.status,JSON.stringify(list.body)).toBe(200);
 const approval=list.body.entities.find((row:Entity)=>row.data.entityId===entityId&&row.status==='in_review') as Entity|undefined;
 expect(approval,`Approval request for ${entityId}`).toBeTruthy();
 return approval!;
}
async function saveMeal(amountMinor=1800,authorizationItemId=itemId){
 return expectSuccess(await send('traveler','expense.save',crypto.randomUUID(),0,{
  tripId,merchant:'Travel Cafe',incurredOn:'2026-10-12',amountMinor,currency:'USD',
  category:'meals',authorizationItemId,paymentMethod:'personal',documentIds:[],description:'Travel-day meal',
 }));
}
function voucherForm(expense:Entity):VoucherModuleInput{
 return {
  tripId,authorizationId,currency:'USD',certified:true,intakeComplete:true,
  expenseItems:[{expenseId:expense.id,authorizationItemId:String(expense.data.authorizationItemId),amountMinor:Number(expense.data.amountMinor),currency:'USD',documentIds:[]}],
  reconciliation:{totalAmountMinor:Number(expense.data.amountMinor),unresolvedIssueIds:[]},resolutions:{},
 };
}
async function saveVoucher(expense:Entity,formData=voucherForm(expense)){
 return expectSuccess(await send('traveler','voucher.save',crypto.randomUUID(),0,{
  tripId,authorizationId,expenseIds:[expense.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData,
 }));
}
async function expectSubmissionRejected(voucher:Entity,message:RegExp){
 const result=await send('traveler','voucher.submit',voucher.id,voucher.version,{});
 expect(result.status,JSON.stringify(result.body)).toBe(422);
 expect(result.body.error.code).toBe('VALIDATION_FAILED');
 expect(result.body.error.message).toMatch(message);
 const saved=await request('traveler','GET',`/v1/entities/voucher/${voucher.id}?organizationId=${organizationId}`);
 expect(saved.body.entity.status).toBe('draft');
 expect(saved.body.entity.version).toBe(voucher.version);
}

beforeAll(async()=>{
 pool=makePool(config);
 app=await buildApp(config,{pool,logger:false});
 const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const name of ['traveler','reviewer','approver','peer','outsider'] as const){
  const email=`connected-${name}-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error)throw created.error;
  const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await client.auth.signInWithPassword({email,password});
  if(signedIn.error)throw signedIn.error;
  users[name]={id:created.data.user.id,token:signedIn.data.session!.access_token,deviceId:crypto.randomUUID()};
 }
 const organization=await request('traveler','POST','/v1/organizations',{name:`Connected travel ${crypto.randomUUID()}`});
 expect(organization.status,JSON.stringify(organization.body)).toBe(201);
 organizationId=organization.body.id;
 const outsiderOrganization=await request('outsider','POST','/v1/organizations',{name:'Independent tenant'});
 expect(outsiderOrganization.status,JSON.stringify(outsiderOrganization.body)).toBe(201);
 for(const user of ['reviewer','approver','peer'] as const){
  const result=await request('traveler','PUT',`/v1/organizations/${organizationId}/members`,{userId:users[user].id,role:user==='peer'?'traveler':user});
  expect(result.status,JSON.stringify(result.body)).toBe(200);
 }
 for(const kind of ['authorization','voucher'] as const){
  expectSuccess(await send('traveler','workflow.configure',crypto.randomUUID(),0,{
   kind,name:'Connected travel review',steps:[{assigneeId:users.reviewer.id,role:'reviewer'},{assigneeId:users.approver.id,role:'approver'}],
  }));
 }
 expectSuccess(await send('traveler','trip.save',tripId,0,{
  destination:'Washington, DC',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Connected planning and voucher integration',timezone:'America/New_York',
 }));
 expectSuccess(await send('traveler','authorization.save',authorizationId,0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning}));
},60000);
afterAll(async()=>{await app?.close();await pool?.end()});

describe('connected planning and Voucher Copilot',()=>{
 it('approves a real planning form only through the assigned review sequence',async()=>{
  const unavailable=await request('traveler','GET',`/v1/authorizations/${authorizationId}/approved?organizationId=${organizationId}`);
  expect(unavailable.status).toBe(409);
  const submitted=expectSuccess(await send('traveler','authorization.submit',authorizationId,1,{}));
  expect(submitted.status).toBe('in_review');
  const approval=await approvalFor(authorizationId);
  for(const user of ['traveler','approver'] as const){
   const denied=await send(user,'approval.decide',approval.id,approval.version,{decision:'approved',comment:''});
   expect(denied.status,JSON.stringify(denied.body)).toBe(403);
   expect(denied.body.error.code).toBe('PERMISSION_DENIED');
  }
  const first=expectSuccess(await send('reviewer','approval.decide',approval.id,approval.version,{decision:'approved',comment:''}));
  expect(first.status).toBe('in_review');
  const final=expectSuccess(await send('approver','approval.decide',approval.id,first.version,{decision:'approved',comment:''}));
  expect(final.status).toBe('approved');
 });

 it('returns the frozen approved handoff and denies another tenant or unassigned traveler',async()=>{
  const url=`/v1/authorizations/${authorizationId}/approved?organizationId=${organizationId}`;
  const approved=await request('traveler','GET',url);
  expect(approved.status,JSON.stringify(approved.body)).toBe(200);
  expect(approved.body.revision.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(approved.body.revision.snapshot.entity.data.formData).toEqual(planning);
  // The frozen revision is the submitted version, before workflow status changes.
  expect(approved.body.revision.snapshot.entity.version).toBe(1);
  expect(approved.body.revision.snapshot.entity.status).toBe('draft');
  const edit=await send('traveler','authorization.save',authorizationId,3,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:{...planning,origin:'Changed'}});
  expect(edit.body.error.code).toBe('INVALID_STATE_TRANSITION');
  expect((await request('traveler','GET',url)).body.revision).toEqual(approved.body.revision);
  for(const user of ['outsider','peer'] as const)expect((await request(user,'GET',url)).status).toBe(404);
 });

 it('verifies a receipt-exempt meal without creating a human Voucher approval',async()=>{
  const expense=await saveMeal();
  const voucher=await saveVoucher(expense);
  const peer=await send('peer','voucher.submit',voucher.id,voucher.version,{});
  expect(peer.body.ok).toBe(false);
  expect(['PERMISSION_DENIED','NOT_FOUND']).toContain(peer.body.error.code);
  const submitted=expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{}));
  expect(submitted.status).toBe('verified');
  const inbox=await request('reviewer','GET',`/v1/entities/approval?organizationId=${organizationId}`);
  expect(inbox.body.entities.some((row:Entity)=>row.data.entityId===voucher.id)).toBe(false);
  const requests=await pool.query('select count(*)::int as count from ouranos.approval_requests where organization_id=$1 and data->>\'entityId\'=$2',[organizationId,voucher.id]);
  expect(requests.rows[0].count).toBe(0);
  const steps=await pool.query('select count(*)::int as count from ouranos.approval_steps where request_id in (select id from ouranos.approval_requests where organization_id=$1 and data->>\'entityId\'=$2)',[organizationId,voucher.id]);
  expect(steps.rows[0].count).toBe(0);
  const verification=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(verification.status,JSON.stringify(verification.body)).toBe(200);
  expect((await request('outsider','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`)).status).toBe(404);
  expect(verification.body.report).toMatchObject({status:'verified',expenseCount:1,receiptCount:0,claimedTotalMinor:1800,personalFundsTotalMinor:1800,blockingIssues:[]});
  expect(verification.body.revision.snapshot.reconciliation).toMatchObject({ready:true,issues:[],totals:{actual:18,traveler:18,gtcc:0}});
  expect(verification.body.report.snapshotSha256).toBe(verification.body.revision.sha256);
  expect(verification.body.revision.snapshot.authorizationRevision.sha256).toMatch(/^[a-f0-9]{64}$/);
  await expect(pool.query('update ouranos.voucher_verifications set result=$1 where revision_id=$2',['needs_action',verification.body.revision.id])).rejects.toThrow(/History is append-only/);
  expectSuccess(await send('traveler','expense.save',expense.id,expense.version,{...expense.data,tripId,amountMinor:1900} as PayloadOf<'expense.save'>));
  const unchanged=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(unchanged.body).toEqual(verification.body);
 });

 it('prevents another voucher from claiming an expense after verification',async()=>{
  const expense=await saveMeal();
  const first=await saveVoucher(expense);
  expectSuccess(await send('traveler','voucher.submit',first.id,first.version,{}));
  const duplicate=await saveVoucher(expense);
  const expectClaimBlocked=async()=>{
   const denied=await send('traveler','voucher.submit',duplicate.id,duplicate.version,{});
   expect(denied.body.ok).toBe(false);
   expect(denied.body.error.code).toBe('INVALID_STATE_TRANSITION');
   expect(denied.body.error.message).toMatch(/already included in another submitted voucher/);
   const saved=await request('traveler','GET',`/v1/entities/voucher/${duplicate.id}?organizationId=${organizationId}`);
   expect(saved.body.entity.status).toBe('draft');
   expect(saved.body.entity.version).toBe(duplicate.version);
  };
  await expectClaimBlocked();
  await expectClaimBlocked();
 });

 it('returns over-budget expenses to the traveler and releases the claim',async()=>{
  const expense=await saveMeal(10000),first=await saveVoucher(expense);
  const result=expectSuccess(await send('traveler','voucher.submit',first.id,first.version,{}));
  expect(result.status).toBe('needs_action');
  const detail=await request('traveler','GET',`/v1/vouchers/${first.id}/verification?organizationId=${organizationId}`);
  expect(detail.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'over_authorization'}));
  const replacement=await saveVoucher(expense);
  expect(expectSuccess(await send('traveler','voucher.submit',replacement.id,replacement.version,{})).status).toBe('needs_action');
 });

 it('rejects an internally consistent client total that contradicts the saved expense',async()=>{
  const expense=await saveMeal();const form=voucherForm(expense);
  form.expenseItems[0].amountMinor=1700;form.reconciliation.totalAmountMinor=1700;
  await expectSubmissionRejected(await saveVoucher(expense,form),/details no longer match saved records/);
 });

 it('rejects an expense changed after Voucher reconciliation was saved',async()=>{
  const expense=await saveMeal(),voucher=await saveVoucher(expense);
  expectSuccess(await send('traveler','expense.save',expense.id,expense.version,{...expense.data,tripId,amountMinor:1900} as PayloadOf<'expense.save'>));
  await expectSubmissionRejected(voucher,/details no longer match saved records/);
 });

 it('rejects forged trip or authorization context inside an otherwise valid voucher',async()=>{
  const expense=await saveMeal();
  for(const key of ['tripId','authorizationId'] as const){
   const form=voucherForm(expense);form[key]=crypto.randomUUID();
   await expectSubmissionRejected(await saveVoucher(expense,form),/context does not match/);
  }
 });

 it('recomputes duplicate and date blockers despite an empty client issue list',async()=>{
  const first=await saveMeal(),second=await saveMeal();
  const form=voucherForm(first);form.expenseItems.push({...form.expenseItems[0],expenseId:second.id});form.reconciliation.totalAmountMinor=3600;
  const voucher=expectSuccess(await send('traveler','voucher.save',crypto.randomUUID(),0,{tripId,authorizationId,expenseIds:[first.id,second.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData:form}));
  expect(expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{})).status).toBe('needs_action');
  const duplicate=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(duplicate.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'possible_duplicate'}));
  const outside=expectSuccess(await send('traveler','expense.save',crypto.randomUUID(),0,{tripId,merchant:'Late meal',incurredOn:'2026-10-20',amountMinor:1800,currency:'USD',category:'meals',authorizationItemId:itemId,paymentMethod:'personal',documentIds:[],description:'Late meal'}));
  const late=await saveVoucher(outside);
  expect(expectSuccess(await send('traveler','voucher.submit',late.id,late.version,{})).status).toBe('needs_action');
  const date=await request('traveler','GET',`/v1/vouchers/${late.id}/verification?organizationId=${organizationId}`);
  expect(date.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'outside_dates'}));
  const fixedExpense=expectSuccess(await send('traveler','expense.save',outside.id,outside.version,{...outside.data,tripId,incurredOn:'2026-10-12'} as PayloadOf<'expense.save'>));
  const updated=expectSuccess(await send('traveler','voucher.save',late.id,2,{tripId,authorizationId,expenseIds:[fixedExpense.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData:voucherForm(fixedExpense)}));
  expect(expectSuccess(await send('traveler','voucher.submit',late.id,updated.version,{})).status).toBe('verified');
 });

 it('returns an unmatched expense for correction',async()=>{
  const expense=await saveMeal(1800,crypto.randomUUID());
  const voucher=await saveVoucher(expense);
  expect(expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{})).status).toBe('needs_action');
  const report=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(report.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'unauthorized'}));
 });
 it('blocks unprocessed receipts and unapproved authorizations',async()=>{
  const document=expectSuccess(await send('traveler','document.register',crypto.randomUUID(),0,{tripId,filename:'meal.png',mediaType:'image/png',byteSize:100,sha256:'a'.repeat(64)}));
  const expense=expectSuccess(await send('traveler','expense.save',crypto.randomUUID(),0,{tripId,merchant:'Meal with receipt',incurredOn:'2026-10-12',amountMinor:1800,currency:'USD',category:'meals',authorizationItemId:itemId,paymentMethod:'personal',documentIds:[document.id],description:'Meal'}));
  const form={...voucherForm(expense),expenseItems:[{...voucherForm(expense).expenseItems[0],documentIds:[document.id]}]};
  const voucher=await saveVoucher(expense,form);
  expect(expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{})).status).toBe('needs_action');
  const detail=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(detail.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_unconfirmed'}));
  const pendingId=crypto.randomUUID();
  expectSuccess(await send('traveler','authorization.save',pendingId,0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning}));
  const pending=expectSuccess(await send('traveler','voucher.save',crypto.randomUUID(),0,{tripId,authorizationId:pendingId,expenseIds:[expense.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData:{...form,authorizationId:pendingId}}));
  const denied=await send('traveler','voucher.submit',pending.id,pending.version,{});
  expect(denied.body.error.code).toBe('INVALID_STATE_TRANSITION');
 });
 it('replays one verification command without duplicating its report and rejects a spoofed verdict',async()=>{
  const expense=await saveMeal(),voucher=await saveVoucher(expense);
  const command={type:'voucher.submit',entityId:voucher.id,expectedVersion:voucher.version,payload:{},organizationId,commandId:crypto.randomUUID(),deviceId:users.traveler.deviceId,schemaVersion:1};
  const first=await request('traveler','POST','/v1/commands',command);
  const repeated=await request('traveler','POST','/v1/commands',command);
  expect(first.body.entity.status).toBe('verified');expect(repeated.body.replayed).toBe(true);
  const reports=await pool.query('select count(*)::int as count from ouranos.voucher_verifications where voucher_id=$1',[voucher.id]);
  expect(reports.rows[0].count).toBe(1);
  const forged=await request('traveler','POST','/v1/commands',{...command,commandId:crypto.randomUUID(),payload:{verified:true}});
  expect(forged.status).toBe(400);
  const spoofExpense=await saveMeal();
  const forgedForm=await saveVoucher(spoofExpense,{...voucherForm(spoofExpense),verified:true} as VoucherModuleInput);
  const rejected=await send('traveler','voucher.submit',forgedForm.id,forgedForm.version,{});
  expect(rejected.body.error.code).toBe('VALIDATION_FAILED');
 });
 it('freezes companion rates and exports the receipt statement through the authenticated API',async()=>{
  const companionId=crypto.randomUUID(),fuelItem=crypto.randomUUID();
  expectSuccess(await send('traveler','authorization.save',companionId,0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:{...planning,allowance:{enabled:true,governmentMess:false,mealsProvided:{}},approvedExpenseItems:[{id:fuelItem,category:'fuel',description:'Fuel',authorizedAmountMinor:10000,expectedPaymentMethod:'gtcc'}]}}));
  expectSuccess(await send('traveler','authorization.submit',companionId,1,{}));
  const approval=await approvalFor(companionId);
  const reviewed=expectSuccess(await send('reviewer','approval.decide',approval.id,approval.version,{decision:'approved',comment:''}));
  expectSuccess(await send('approver','approval.decide',approval.id,reviewed.version,{decision:'approved',comment:''}));
  const approved=await request('traveler','GET',`/v1/authorizations/${companionId}/approved?organizationId=${organizationId}`);
  expect(approved.body.revision.snapshot.perDiem.supported).toBe(true);
  const expense=expectSuccess(await send('traveler','expense.save',crypto.randomUUID(),0,{tripId,merchant:'Companion fuel',incurredOn:'2026-10-12',amountMinor:10000,currency:'USD',category:'fuel',authorizationItemId:fuelItem,paymentMethod:'gtcc',documentIds:[],description:'Fuel'}));
  const form:VoucherModuleInput={...voucherForm(expense),authorizationId:companionId};
  const voucher=expectSuccess(await send('traveler','voucher.save',crypto.randomUUID(),0,{tripId,authorizationId:companionId,expenseIds:[expense.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData:form}));
  const url=`/v1/vouchers/${voucher.id}/package?organizationId=${organizationId}`;
  expect((await request('traveler','GET',url)).status).toBe(409);
  const blocked=expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{}));
  expect(blocked.status).toBe('needs_action');
  const report=await request('traveler','GET',`/v1/vouchers/${voucher.id}/verification?organizationId=${organizationId}`);
  expect(report.body.report.blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_missing'}));
  const resolved={...form,resolutions:{[`${expense.id}:receipt_missing`]:{type:'lost_receipt_statement' as const,value:{reason:'Paper receipt lost during travel.',expenseVersion:expense.version}}}};
  const saved=expectSuccess(await send('traveler','voucher.save',voucher.id,blocked.version,{tripId,authorizationId:companionId,expenseIds:[expense.id],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData:resolved}));
  expect(expectSuccess(await send('traveler','voucher.submit',voucher.id,saved.version,{})).status).toBe('verified');
  const exported=await request('traveler','GET',url);expect(exported.status,JSON.stringify(exported.body)).toBe(200);
  expect(exported.body.html).toContain('LOST RECEIPT STATEMENT');
  expect(exported.body.html).toContain('Companion fuel');
  expect(exported.body.snapshot.statements[`${expense.id}:receipt_missing`].value.amount).toBe(100);
  for(const user of ['outsider','peer'] as const)expect((await request(user,'GET',url)).status).toBe(404);
  expectSuccess(await send('traveler','expense.save',expense.id,expense.version,{...expense.data,tripId,merchant:'Changed live merchant'} as PayloadOf<'expense.save'>));
  const frozen=await request('traveler','GET',url);expect(frozen.body).toEqual(exported.body);
 });

});
