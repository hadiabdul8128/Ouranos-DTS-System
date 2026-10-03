import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import type {Command,CommandType,Entity,PayloadOf} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION,type PlanningModuleInput} from '../../packages/contracts/planning-module';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Amendment integration tests require loopback Supabase and Postgres endpoints');

type User='admin'|'s1'|'command'|'member'|'stranger';
const names:User[]=['admin','s1','command','member','stranger'];
const users={} as Record<User,{id:string;token:string;deviceId:string;email:string}>;
let app:Awaited<ReturnType<typeof buildApp>>,pool:Pool,organizationId:string;

async function call(user:User,method:'GET'|'POST'|'PUT',url:string,payload?:unknown){
 const response=await app.inject({method,url,remoteAddress:`127.0.3.${names.indexOf(user)+1}`,headers:{authorization:`Bearer ${users[user].token}`},payload:payload as object});
 return {status:response.statusCode,body:response.json()};
}
async function send<T extends CommandType>(user:User,type:T,entityId:string,expectedVersion:number,payload:PayloadOf<T>){
 return call(user,'POST','/v1/commands',{type,entityId,expectedVersion,payload,organizationId,commandId:crypto.randomUUID(),deviceId:users[user].deviceId,schemaVersion:1} as Command);
}
function ok(result:{status:number;body:any}):Entity{expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.ok,JSON.stringify(result.body)).toBe(true);return result.body.entity}
async function submitted(user:User){
 const trip=ok(await send(user,'trip.save',crypto.randomUUID(),0,{destination:'Denver, CO',departure:'2026-11-05',returnDate:'2026-11-08',purpose:'Training',timezone:'UTC'}));
 const planning:PlanningModuleInput={traveler:'Demo Traveler',origin:'Austin, TX',travelMode:'air',currency:'USD',approvedExpenseItems:[{id:crypto.randomUUID(),category:'airfare',description:'Round-trip flight',authorizedAmountMinor:43000}]};
 const plan=ok(await send(user,'authorization.save',crypto.randomUUID(),0,{tripId:trip.id,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning}));
 expect(ok(await send(user,'authorization.submit',plan.id,plan.version,{})).status).toBe('in_review');
 return {trip,plan};
}

beforeAll(async()=>{
 pool=makePool(config);
 app=await buildApp({...config,APPROVAL_MODE:'required'},{pool,logger:false});
 const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const name of names){
  const email=`amend-${name}-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await client.auth.signInWithPassword({email,password});if(signedIn.error)throw signedIn.error;
  users[name]={id:created.data.user.id,token:signedIn.data.session!.access_token,deviceId:crypto.randomUUID(),email};
 }
 organizationId=(await call('admin','POST','/v1/organizations',{name:`Amend ${crypto.randomUUID()}`})).body.id;
 for(const [name,role] of [['s1','reviewer'],['command','approver'],['member','traveler'],['stranger','traveler']] as const)
  expect((await call('admin','PUT',`/v1/organizations/${organizationId}/members`,{userId:users[name].id,role})).status).toBe(200);
 expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.member.email,level:'s1'})).status).toBe(200);
 expect((await call('command','POST','/v1/team/members',{organizationId,email:users.member.email,level:'command'})).status).toBe(200);
});
afterAll(async()=>{await app?.close();await pool?.end()});

async function approveAll(planId:string){
 for(const leader of ['s1','command'] as const){
  const request=(await call(leader,'GET',`/v1/entities/approval?organizationId=${organizationId}`)).body.entities.filter((e:Entity)=>e.data.entityId===planId&&e.status==='in_review')[0] as Entity;
  ok(await send(leader,'approval.decide',request.id,request.version,{decision:'approved',comment:''}));
 }
}
const getPlan=async(id:string)=>(await call('member','GET',`/v1/entities/authorization/${id}?organizationId=${organizationId}`)).body.entity as Entity;

describe('changing an approved plan',()=>{
 it('reopens it with what was approved, re-routes it, and uses the new version for the voucher',async()=>{
  const {trip,plan}=await submitted('member');
  await approveAll(plan.id);
  let current=await getPlan(plan.id);expect(current.status).toBe('approved');
  expect((await send('member','authorization.amend',plan.id,current.version,{reason:'short'})).status).toBe(400);
  const stranger=await send('stranger','authorization.amend',plan.id,current.version,{reason:'Orders were extended two days'});
  expect(stranger.body.ok).toBe(false);expect(['PERMISSION_DENIED','NOT_FOUND']).toContain(stranger.body.error.code);
  const amended=ok(await send('member','authorization.amend',plan.id,current.version,{reason:'Orders were extended two days'}));
  expect(amended.status).toBe('draft');
  const form=amended.data.formData as Record<string,any>;
  expect(form.amendment).toMatchObject({number:1,reason:'Orders were extended two days',previous:{destination:'Denver, CO',returnDate:'2026-11-08',items:[{authorizedAmountMinor:43000}]}});
  const voucher=await send('member','voucher.save',crypto.randomUUID(),0,{tripId:trip.id,authorizationId:plan.id,expenseIds:[crypto.randomUUID()],formSchemaVersion:'ouranos.voucher.v1',formData:{}});
  expect(voucher.body.error.code).toBe('INVALID_STATE_TRANSITION');
  const movedTrip=ok(await send('member','trip.save',trip.id,trip.version,{destination:'Denver, CO',departure:'2026-11-05',returnDate:'2026-11-10',purpose:'Training',timezone:'UTC'}));
  expect(movedTrip.data.returnDate).toBe('2026-11-10');
  const items=[...(form.approvedExpenseItems as unknown[]),{id:crypto.randomUUID(),category:'lodging',description:'Hotel',authorizedAmountMinor:37600}];
  const saved=ok(await send('member','authorization.save',plan.id,amended.version,{tripId:trip.id,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:{...form,approvedExpenseItems:items}}));
  expect(ok(await send('member','authorization.submit',plan.id,saved.version,{})).status).toBe('in_review');
  await approveAll(plan.id);
  current=await getPlan(plan.id);expect(current.status).toBe('approved');
  const revision=(await pool.query("select r.snapshot from ouranos.submission_revisions r join ouranos.approval_requests a on a.revision_id=r.id where r.authorization_id=$1 and a.status='approved' order by r.created_at desc limit 1",[plan.id])).rows[0];
  expect(revision.snapshot.trip.data.returnDate).toBe('2026-11-10');
  expect(revision.snapshot.entity.data.formData.approvedExpenseItems).toHaveLength(2);
  const again=ok(await send('member','authorization.amend',plan.id,current.version,{reason:'Hotel changed to the base'}));
  expect((again.data.formData as any).amendment).toMatchObject({number:2,previous:{returnDate:'2026-11-10'}});
 });
 it('refuses to reopen a plan that is not approved',async()=>{
  const {plan}=await submitted('member');
  const current=await getPlan(plan.id);
  const refused=await send('member','authorization.amend',plan.id,current.version,{reason:'Orders were extended two days'});
  expect(refused.body.error).toMatchObject({code:'INVALID_STATE_TRANSITION',message:'Only an approved plan can be changed'});
 });
});
