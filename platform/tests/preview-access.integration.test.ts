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
 app=await buildApp({...config,APPROVAL_MODE:'preview'},{pool,logger:false});
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
 expectSuccess(await send('traveler','trip.save',tripId,0,{
  destination:'Washington, DC',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Connected planning and voucher integration',timezone:'America/New_York',
 }));
 expectSuccess(await send('traveler','authorization.save',authorizationId,0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning}));
},60000);
afterAll(async()=>{await app?.close();await pool?.end()});


describe('temporary approval-free access',()=>{
 it('opens working plans and exports drafts without inventing approvals',async()=>{
  expect((await request('traveler','GET','/v1/session')).body.approvalMode).toBe('preview');
  const workingUrl=`/v1/authorizations/${authorizationId}/working?organizationId=${organizationId}`;
  const working=await request('traveler','GET',workingUrl);
  expect(working.status,JSON.stringify(working.body)).toBe(200);
  expect(working.body.revision.snapshot.entity.status).toBe('draft');
  expect((await request('traveler','GET',workingUrl.replace('/working?','/approved?'))).status).toBe(409);
  const expense=await saveMeal();
  const form=voucherForm(expense);
  const voucher=await saveVoucher(expense,{...form,certified:false,intakeComplete:false} as unknown as VoucherModuleInput);
  const url=`/v1/vouchers/${voucher.id}/package?organizationId=${organizationId}`;
  const exported=await request('traveler','GET',url);
  expect(exported.status,JSON.stringify(exported.body)).toBe(200);
  expect(exported.body.status).toBe('draft');
  expect(exported.body.snapshot.preview).toBe(true);
  expect(exported.body.html).toContain('Draft preview — not approved');
  for(const user of ['peer','outsider'] as const){
   expect((await request(user,'GET',workingUrl)).status).toBe(404);
   expect((await request(user,'GET',url)).status).toBe(404);
  }
  const normal=await buildApp({...config,APPROVAL_MODE:'required'},{pool,logger:false});
  try{
   const headers={authorization:`Bearer ${users.traveler.token}`};
   expect((await normal.inject({method:'GET',url:workingUrl,headers})).statusCode).toBe(403);
   expect((await normal.inject({method:'GET',url,headers})).statusCode).toBe(409);
  }finally{await normal.close()}
  for(const table of ['approval_requests','submission_revisions','approval_decisions']){
   expect(Number((await pool.query(`select count(*) from ouranos.${table} where organization_id=$1`,[organizationId])).rows[0].count)).toBe(0);
  }
  const formal=await send('traveler','authorization.submit',authorizationId,1,{});
  expect(formal.body.ok).toBe(false);
 });
});
