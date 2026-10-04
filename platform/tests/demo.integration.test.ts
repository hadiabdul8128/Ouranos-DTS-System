import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import type {Command,CommandType,Entity,PayloadOf} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION,type PlanningModuleInput} from '../../packages/contracts/planning-module';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Demo integration tests require loopback Supabase and Postgres endpoints');

type User='admin'|'s1'|'command'|'member'|'stranger';
const names:User[]=['admin','s1','command','member','stranger'];
const users={} as Record<User,{id:string;token:string;deviceId:string;email:string}>;
const demoOrganizations:string[]=[];
let app:Awaited<ReturnType<typeof buildApp>>,pool:Pool,organizationId:string;

async function call(user:User,method:'GET'|'POST'|'PUT',url:string,payload?:unknown){
 const response=await app.inject({method,url,remoteAddress:`127.0.2.${names.indexOf(user)+1}`,headers:{authorization:`Bearer ${users[user].token}`},payload:payload as object});
 return {status:response.statusCode,body:response.json()};
}
async function send<T extends CommandType>(user:User,type:T,entityId:string,expectedVersion:number,payload:PayloadOf<T>,targetOrganizationId=organizationId){
 return call(user,'POST','/v1/commands',{type,entityId,expectedVersion,payload,organizationId:targetOrganizationId,commandId:crypto.randomUUID(),deviceId:users[user].deviceId,schemaVersion:1} as Command);
}
function ok(result:{status:number;body:any}):Entity{expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.ok,JSON.stringify(result.body)).toBe(true);return result.body.entity}
async function submitted(user:User,targetOrganizationId=organizationId){
 const trip=ok(await send(user,'trip.save',crypto.randomUUID(),0,{destination:'Denver, CO',departure:'2026-11-05',returnDate:'2026-11-08',purpose:'Training',timezone:'UTC'},targetOrganizationId));
 const planning:PlanningModuleInput={traveler:'Demo Traveler',origin:'Austin, TX',travelMode:'air',currency:'USD',approvedExpenseItems:[{id:crypto.randomUUID(),category:'airfare',description:'Round-trip flight',authorizedAmountMinor:43000}]};
 const plan=ok(await send(user,'authorization.save',crypto.randomUUID(),0,{tripId:trip.id,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning},targetOrganizationId));
 expect(ok(await send(user,'authorization.submit',plan.id,plan.version,{},targetOrganizationId)).status).toBe('in_review');
 return {trip,plan};
}

beforeAll(async()=>{
 pool=makePool(config);
 app=await buildApp({...config,APPROVAL_MODE:'required',DEMO_APPROVAL_ALL_WORKSPACES:true,DEMO_APPROVAL_ORGANIZATIONS:demoOrganizations},{pool,logger:false});
 const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const name of names){
  const email=`demo-${name}-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await client.auth.signInWithPassword({email,password});if(signedIn.error)throw signedIn.error;
  users[name]={id:created.data.user.id,token:signedIn.data.session!.access_token,deviceId:crypto.randomUUID(),email};
 }
 organizationId=(await call('admin','POST','/v1/organizations',{name:`Demo ${crypto.randomUUID()}`})).body.id;
 for(const [name,role] of [['s1','reviewer'],['command','approver'],['member','traveler'],['stranger','traveler']] as const)
  expect((await call('admin','PUT',`/v1/organizations/${organizationId}/members`,{userId:users[name].id,role})).status).toBe(200);
 expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.member.email,level:'s1'})).status).toBe(200);
 expect((await call('command','POST','/v1/team/members',{organizationId,email:users.member.email,level:'command'})).status).toBe(200);
});
afterAll(async()=>{await app?.close();await pool?.end()});

describe('demo approval',()=>{
 it('enables demo approval without allowlisting the workspace',async()=>{
  const {plan}=await submitted('member');
  const session=(await call('member','GET','/v1/session')).body;
  expect(session.demoApprovalEnabled).toBe(true);expect(session.demoApprovalOrganizations).toContain(organizationId);
  expect((await call('member','POST','/v1/demo/approve',{organizationId,authorizationId:plan.id})).status).toBe(200);
 });
 it('works immediately in a newly created workspace while enforcing membership',async()=>{
  const other=(await call('stranger','POST','/v1/organizations',{name:'New demo access workspace'})).body.id;
  const {plan}=await submitted('stranger',other);
  expect((await call('stranger','GET','/v1/session')).body.demoApprovalOrganizations).toContain(other);
  expect((await call('member','GET','/v1/session')).body.demoApprovalOrganizations).not.toContain(other);
  expect([403,404]).toContain((await call('member','POST','/v1/demo/approve',{organizationId:other,authorizationId:plan.id})).status);
  expect((await call('stranger','POST','/v1/demo/approve',{organizationId:other,authorizationId:plan.id})).status).toBe(200);
  expect((await call('stranger','GET',`/v1/authorizations/${plan.id}/approved?organizationId=${other}`)).status).toBe(200);
 });
 it('honors an explicit restricted deployment setting',async()=>{
  const restricted=await buildApp({...config,APPROVAL_MODE:'required',DEMO_APPROVAL_ALL_WORKSPACES:false,DEMO_APPROVAL_ORGANIZATIONS:[]},{pool,logger:false});
  try{
   const {plan}=await submitted('member');
   const response=await restricted.inject({method:'POST',url:'/v1/demo/approve',headers:{authorization:`Bearer ${users.member.token}`},payload:{organizationId,authorizationId:plan.id}});
   expect(response.statusCode).toBe(403);
  }finally{await restricted.close()}
 });
 it('approves every level of the traveler’s own plan, records it, and opens the voucher',async()=>{
  demoOrganizations.push(organizationId);
  const {trip,plan}=await submitted('member');
  expect([403,404]).toContain((await call('stranger','POST','/v1/demo/approve',{organizationId,authorizationId:plan.id})).status);
  const approved=await call('member','POST','/v1/demo/approve',{organizationId,authorizationId:plan.id});
  expect(approved.status,JSON.stringify(approved.body)).toBe(200);
  expect(approved.body.entity.status).toBe('approved');
  expect((await call('member','GET',`/v1/authorizations/${plan.id}/approved?organizationId=${organizationId}`)).status).toBe(200);
  const request=(await call('member','GET',`/v1/entities/approval?organizationId=${organizationId}`)).body.entities.find((e:Entity)=>e.data.entityId===plan.id) as Entity;
  expect(request.status).toBe('approved');
  expect((request.data.levels as Array<{status:string;comment:string}>).every(level=>level.status==='approved'&&level.comment==='Approved for demo')).toBe(true);
  const decisions=(await pool.query('select decision,comment from ouranos.approval_decisions where request_id=$1',[request.id])).rows;
  expect(decisions).toEqual([{decision:'approved',comment:'Approved for demo'},{decision:'approved',comment:'Approved for demo'}]);
  expect((await pool.query("select count(*)::int as n from ouranos.audit_events where action='approval.demo_approved' and entity_id=$1",[plan.id])).rows[0].n).toBe(1);
  const voucherExpense=await send('member','expense.save',crypto.randomUUID(),0,{tripId:trip.id,merchant:'Delta',incurredOn:'2026-11-05',amountMinor:41250,currency:'USD',category:'airfare',description:'',documentIds:[]});
  expect(voucherExpense.status).toBe(200);
  expect((await call('member','POST','/v1/demo/approve',{organizationId,authorizationId:plan.id})).status).toBe(409);
 });
 it('opens the immutable voucher revision for a demo traveler without assigned approvers',async()=>{
  const {plan}=await submitted('stranger');
  const before=(await pool.query('select id,sha256,snapshot from ouranos.submission_revisions where authorization_id=$1',[plan.id])).rows[0];
  expect((await call('stranger','POST','/v1/demo/approve',{organizationId,authorizationId:plan.id})).status).toBe(200);
  const loaded=await call('stranger','GET',`/v1/authorizations/${plan.id}/approved?organizationId=${organizationId}`);
  expect(loaded.status,JSON.stringify(loaded.body)).toBe(200);
  expect(loaded.body.revision).toEqual(before);
  const audit=(await pool.query("select details from ouranos.audit_events where entity_id=$1 and action='approval.demo_approved'",[plan.id])).rows[0];
  expect(audit.details).toEqual({requestId:null,revisionId:before.id});
 });
 it('recovers previously demo-approved plans using their original audit without approving unrelated plans',async()=>{
  const {trip,plan}=await submitted('stranger');
  const {plan:unrelated}=await submitted('stranger');
  // Reproduce the old demo route's data, on this isolated test database only.
  await pool.query("update ouranos.authorizations set status='approved' where id=any($1::uuid[])",[[plan.id,unrelated.id]]);
  await pool.query("insert into ouranos.audit_events(organization_id,trip_id,actor_id,action,entity_id,details) values($1,$2,$3,'approval.demo_approved',$4,$5)",[organizationId,trip.id,users.stranger.id,plan.id,{requestId:null}]);
  expect((await call('stranger','GET',`/v1/authorizations/${plan.id}/approved?organizationId=${organizationId}`)).status).toBe(200);
  expect((await call('stranger','GET',`/v1/authorizations/${unrelated.id}/approved?organizationId=${organizationId}`)).status).toBe(409);
 });
});


describe('unfinished draft deletion',()=>{
 it('keeps the draft records, syncs deletion, and restores the same trip',async()=>{
  const trip=ok(await send('member','trip.save',crypto.randomUUID(),0,{destination:'Draft destination',departure:'2026-11-05',returnDate:'2026-11-08',purpose:'Training',timezone:'UTC'}));
  const plan=ok(await send('member','authorization.save',crypto.randomUUID(),0,{tripId:trip.id,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:{traveler:'Traveler',origin:'Austin',travelMode:'air',currency:'USD',approvedExpenseItems:[]}}));
  const command:Command={type:'trip.delete',entityId:trip.id,expectedVersion:trip.version,payload:{},organizationId,commandId:crypto.randomUUID(),deviceId:users.member.deviceId,schemaVersion:1};
  const deleted=ok(await call('member','POST','/v1/commands',command));expect(deleted.status).toBe('cancelled');
  expect((await call('member','POST','/v1/commands',command)).body.replayed).toBe(true);
  expect((await send('member','trip.restore',trip.id,trip.version,{})).body.error.code).toBe('VERSION_CONFLICT');
  expect((await send('member','trip.save',trip.id,deleted.version,trip.data as PayloadOf<'trip.save'>)).body.error.code).toBe('INVALID_STATE_TRANSITION');
  expect((await send('member','authorization.submit',plan.id,plan.version,{})).body.error.code).toBe('INVALID_STATE_TRANSITION');
  expect((await send('member','authorization.save',plan.id,plan.version,plan.data as PayloadOf<'authorization.save'>)).body.error.code).toBe('INVALID_STATE_TRANSITION');
  const restored=ok(await send('member','trip.restore',trip.id,deleted.version,{}));expect(restored.status).toBe('draft');expect(restored.data).toEqual(trip.data);
  expect((await pool.query('select status from ouranos.authorizations where id=$1',[plan.id])).rows[0].status).toBe('draft');
  expect((await pool.query("select entity->>'status' as status from ouranos.change_log where entity_id=$1 order by cursor desc limit 1",[trip.id])).rows[0].status).toBe('draft');
 });
 it('refuses other travelers and submitted plans',async()=>{
  const {trip}=await submitted('member');
  expect((await send('stranger','trip.delete',trip.id,trip.version,{})).body.error.code).toBe('PERMISSION_DENIED');
  expect((await send('member','trip.delete',trip.id,trip.version,{})).body.error.code).toBe('INVALID_STATE_TRANSITION');
 });
});
