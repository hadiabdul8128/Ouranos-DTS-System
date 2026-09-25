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

 it('submits and approves a receipt-exempt meal with server-computed reconciliation',async()=>{
  const expense=await saveMeal();
  const voucher=await saveVoucher(expense);
  const peer=await send('peer','voucher.submit',voucher.id,voucher.version,{});
  expect(peer.body.ok).toBe(false);
  expect(['PERMISSION_DENIED','NOT_FOUND']).toContain(peer.body.error.code);
  const submitted=expectSuccess(await send('traveler','voucher.submit',voucher.id,voucher.version,{}));
  expect(submitted.status).toBe('in_review');
  const approval=await approvalFor(voucher.id);
  const self=await send('traveler','approval.decide',approval.id,approval.version,{decision:'approved',comment:''});
  expect(self.status).toBe(403);
  const first=expectSuccess(await send('reviewer','approval.decide',approval.id,approval.version,{decision:'approved',comment:''}));
  expectSuccess(await send('approver','approval.decide',approval.id,first.version,{decision:'approved',comment:''}));
  const revision=await request('reviewer','GET',`/v1/approvals/${approval.id}/revision?organizationId=${organizationId}`);
  expect(revision.status,JSON.stringify(revision.body)).toBe(200);
  expect(revision.body.revision.snapshot.reconciliation).toMatchObject({ready:true,issues:[],totals:{actual:18,traveler:18,gtcc:0}});
  expect(revision.body.revision.snapshot.authorizationRevision.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(revision.body.revision.snapshot.documents).toEqual([]);
  expect(revision.body.decisions).toHaveLength(2);
  expectSuccess(await send('traveler','expense.save',expense.id,expense.version,{...expense.data,tripId,amountMinor:1900} as PayloadOf<'expense.save'>));
  const unchanged=await request('reviewer','GET',`/v1/approvals/${approval.id}/revision?organizationId=${organizationId}`);
  expect(unchanged.body.revision).toEqual(revision.body.revision);
 });

 it('prevents another voucher from claiming an expense while it is in review or approved',async()=>{
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
  const approval=await approvalFor(first.id);
  const reviewed=expectSuccess(await send('reviewer','approval.decide',approval.id,approval.version,{decision:'approved',comment:''}));
  expectSuccess(await send('approver','approval.decide',approval.id,reviewed.version,{decision:'approved',comment:''}));
  await expectClaimBlocked();
 });

 it('releases expense claims after changes are requested or a voucher is rejected',async()=>{
  for(const decision of ['changes_requested','rejected'] as const){
   const expense=await saveMeal();
   const first=await saveVoucher(expense);
   expectSuccess(await send('traveler','voucher.submit',first.id,first.version,{}));
   const approval=await approvalFor(first.id);
   expectSuccess(await send('reviewer','approval.decide',approval.id,approval.version,{decision,comment:'Please revise this voucher.'}));
   // A changed voucher may resubmit its own expense without conflicting with itself.
   if(decision==='changes_requested'){
    const current=await request('traveler','GET',`/v1/entities/voucher/${first.id}?organizationId=${organizationId}`);
    const resubmitted=expectSuccess(await send('traveler','voucher.submit',first.id,current.body.entity.version,{}));
    expect(resubmitted.status).toBe('in_review');
    const nextApproval=await approvalFor(first.id);
    expectSuccess(await send('reviewer','approval.decide',nextApproval.id,nextApproval.version,{decision,comment:'Please revise this voucher.'}));
   }
   const replacement=await saveVoucher(expense);
   const submitted=expectSuccess(await send('traveler','voucher.submit',replacement.id,replacement.version,{}));
   expect(submitted.status).toBe('in_review');
  }
 });

 it('rejects an internally consistent client total that contradicts the saved expense',async()=>{
  const expense=await saveMeal();const form=voucherForm(expense);
  form.expenseItems[0].amountMinor=1700;form.reconciliation.totalAmountMinor=1700;
  await expectSubmissionRejected(await saveVoucher(expense,form),/details no longer match saved records/);
 });

 it('rejects forged trip or authorization context inside an otherwise valid voucher',async()=>{
  const expense=await saveMeal();
  for(const key of ['tripId','authorizationId'] as const){
   const form=voucherForm(expense);form[key]=crypto.randomUUID();
   await expectSubmissionRejected(await saveVoucher(expense,form),/context does not match/);
  }
 });

 it('recomputes over-budget blockers despite an empty client issue list',async()=>{
  const expense=await saveMeal(10000);
  await expectSubmissionRejected(await saveVoucher(expense),/above the authorized/);
 });

 it('rejects a persisted expense matched to an item outside the approved authorization',async()=>{
  const expense=await saveMeal(1800,crypto.randomUUID());
  await expectSubmissionRejected(await saveVoucher(expense),/not matched to an approved/);
 });
});
