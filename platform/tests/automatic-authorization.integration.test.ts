import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import type {Command} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION,type PlanningModuleInput} from '../../packages/contracts/planning-module';
import {VOUCHER_MODULE_SCHEMA_VERSION} from '../../packages/contracts/voucher-module';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL]){
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Automatic authorization integration tests require local services');
}
const tripId=crypto.randomUUID(),authorizationId=crypto.randomUUID(),itemId=crypto.randomUUID();
const plan:PlanningModuleInput={traveler:'Test Traveler',origin:'Raleigh, NC',currency:'USD',approvedExpenseItems:[
 {id:itemId,category:'meals',description:'Travel-day meal',authorizedAmountMinor:13000,date:'2026-10-12',expectedPaymentMethod:'personal'},
]};
let app:Awaited<ReturnType<typeof buildApp>>,pool:Pool,organizationId:string,token:string,deviceId:string;

async function request(method:'GET'|'POST',url:string,payload?:unknown){
 const response=await app.inject({method,url,headers:{authorization:`Bearer ${token}`},payload:payload as object});
 return {status:response.statusCode,body:response.json()};
}
function command(type:Command['type'],entityId:string,expectedVersion:number,payload:unknown):Command{
 return {type,entityId,expectedVersion,payload,organizationId,commandId:crypto.randomUUID(),deviceId,schemaVersion:1} as Command;
}
async function send(type:Command['type'],entityId:string,expectedVersion:number,payload:unknown){return request('POST','/v1/commands',command(type,entityId,expectedVersion,payload))}

beforeAll(async()=>{
 pool=makePool(config);app=await buildApp({...config,APPROVAL_MODE:'automatic'},{pool,logger:false});
 const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=`automatic-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
 const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const signedIn=await client.auth.signInWithPassword({email,password});if(signedIn.error)throw signedIn.error;
 token=signedIn.data.session!.access_token;deviceId=crypto.randomUUID();
 const organization=await request('POST','/v1/organizations',{name:`Automatic verification ${crypto.randomUUID()}`});expect(organization.status).toBe(201);organizationId=organization.body.id;
},60000);
afterAll(async()=>{await app?.close();await pool?.end()});

describe('automatic authorization handoff',()=>{
 it('rejects out-of-trip dates and unsupported form versions without locking the plan',async()=>{
  const trip=await send('trip.save',tripId,0,{destination:'San Diego, CA',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Four-day TDY',timezone:'America/Los_Angeles'});
  expect(trip.status,JSON.stringify(trip.body)).toBe(200);
  const invalid={...plan,approvedExpenseItems:[{...plan.approvedExpenseItems[0],date:'2026-10-20'}]};
  const saved=await send('authorization.save',authorizationId,0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:invalid});
  expect(saved.status,JSON.stringify(saved.body)).toBe(200);
  const rejected=await send('authorization.submit',authorizationId,1,{});
  expect(rejected.body.error.code).toBe('VALIDATION_FAILED');expect(rejected.body.error.message).toMatch(/dates must fall within the trip/);
  const unchanged=await request('GET',`/v1/entities/authorization/${authorizationId}?organizationId=${organizationId}`);
  expect(unchanged.body.entity.status).toBe('draft');
  const obsoleteId=crypto.randomUUID();
  expect((await send('authorization.save',obsoleteId,0,{tripId,formSchemaVersion:'ouranos.fixture.v1',formData:{purpose:'Fixture'}})).status).toBe(200);
  const obsolete=await send('authorization.submit',obsoleteId,1,{});
  expect(obsolete.body.error.code).toBe('VALIDATION_FAILED');expect(obsolete.body.error.message).toMatch(/current planning form/);
 });

 it('verifies without a reviewer, freezes the revision, and opens Voucher',async()=>{
  const saved=await send('authorization.save',authorizationId,1,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:plan});
  expect(saved.status,JSON.stringify(saved.body)).toBe(200);
  const submitted=await send('authorization.submit',authorizationId,2,{});
  expect(submitted.status,JSON.stringify(submitted.body)).toBe(200);expect(submitted.body.entity.status).toBe('approved');
  const approvals=await request('GET',`/v1/entities/approval?organizationId=${organizationId}`);
  expect(approvals.body.entities).toHaveLength(0);
  const handoff=await request('GET',`/v1/authorizations/${authorizationId}/approved?organizationId=${organizationId}`);
  expect(handoff.status,JSON.stringify(handoff.body)).toBe(200);
  expect(handoff.body.revision.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(handoff.body.revision.snapshot.verification).toMatchObject({mode:'automatic',result:'verified',authorizedTotalMinor:13000});
  expect(handoff.body.revision.snapshot.entity.data.formData).toEqual(plan);
  const delivery=await send('integration.request',authorizationId,submitted.body.entity.version,{kind:'authorization'});
  expect(delivery.body.error.code).toBe('INVALID_STATE_TRANSITION');
  expect(delivery.body.error.message).toMatch(/separately approved revision/);
  const expenseId=crypto.randomUUID(),voucherId=crypto.randomUUID();
  const expense=await send('expense.save',expenseId,0,{tripId,merchant:'Travel Cafe',incurredOn:'2026-10-12',amountMinor:1800,currency:'USD',category:'meals',authorizationItemId:itemId,paymentMethod:'personal',documentIds:[],description:'Travel-day meal'});
  expect(expense.status,JSON.stringify(expense.body)).toBe(200);
  const formData={tripId,authorizationId,currency:'USD',certified:true,intakeComplete:true,expenseItems:[{expenseId,authorizationItemId:itemId,amountMinor:1800,currency:'USD',documentIds:[]}],reconciliation:{totalAmountMinor:1800,unresolvedIssueIds:[]},resolutions:{}};
  const voucher=await send('voucher.save',voucherId,0,{tripId,authorizationId,expenseIds:[expenseId],formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData});
  expect(voucher.status,JSON.stringify(voucher.body)).toBe(200);
  const verified=await send('voucher.submit',voucherId,1,{});
  expect(verified.status,JSON.stringify(verified.body)).toBe(200);expect(verified.body.entity.status).toBe('verified');
 });
});
