import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import type {Command,CommandType,Entity,PayloadOf} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION,type PlanningModuleInput} from '../../packages/contracts/planning-module';
import type {TeamPerson} from '../../packages/contracts/team';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Team integration tests require loopback Supabase and Postgres endpoints');

type User='admin'|'s1'|'command'|'member'|'stranger'|'outsider';
const names:User[]=['admin','s1','command','member','stranger','outsider'];
const users={} as Record<User,{id:string;token:string;deviceId:string;email:string}>;
let app:Awaited<ReturnType<typeof buildApp>>,pool:Pool,organizationId:string;

async function call(user:User,method:'GET'|'POST'|'PUT'|'DELETE',url:string,payload?:unknown){
 const response=await app.inject({method,url,remoteAddress:`127.0.1.${names.indexOf(user)+1}`,headers:{authorization:`Bearer ${users[user].token}`},payload:payload as object});
 return {status:response.statusCode,body:response.json()};
}
async function send<T extends CommandType>(user:User,type:T,entityId:string,expectedVersion:number,payload:PayloadOf<T>){
 return call(user,'POST','/v1/commands',{type,entityId,expectedVersion,payload,organizationId,commandId:crypto.randomUUID(),deviceId:users[user].deviceId,schemaVersion:1} as Command);
}
function ok(result:{status:number;body:any}):Entity{expect(result.status,JSON.stringify(result.body)).toBe(200);expect(result.body.ok,JSON.stringify(result.body)).toBe(true);return result.body.entity}
const team=async(user:User)=>(await call(user,'GET',`/v1/team?organizationId=${organizationId}&today=2026-10-20`)).body.people as TeamPerson[];

beforeAll(async()=>{
 pool=makePool(config);
 app=await buildApp({...config,APPROVAL_MODE:'required'},{pool,logger:false});
 const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const name of names){
  const email=`team-${name}-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await client.auth.signInWithPassword({email,password});if(signedIn.error)throw signedIn.error;
  users[name]={id:created.data.user.id,token:signedIn.data.session!.access_token,deviceId:crypto.randomUUID(),email};
 }
 organizationId=(await call('admin','POST','/v1/organizations',{name:`Team ${crypto.randomUUID()}`})).body.id;
 for(const [name,role] of [['s1','reviewer'],['command','approver'],['member','traveler'],['stranger','traveler']] as const)
  expect((await call('admin','PUT',`/v1/organizations/${organizationId}/members`,{userId:users[name].id,role})).status).toBe(200);
 await call('outsider','POST','/v1/organizations',{name:'Other unit'});
});
afterAll(async()=>{await app?.close();await pool?.end()});

describe('leaders and their people',()=>{
 let tripId:string,planId:string;
 it('lets each leader add people at their own level only',async()=>{
  expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.member.email,level:'s1'})).status).toBe(200);
  expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.member.email.toUpperCase(),level:'command'})).status).toBe(403);
  expect((await call('command','POST','/v1/team/members',{organizationId,email:users.member.email,level:'command'})).status).toBe(200);
  expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.outsider.email,level:'s1'})).status).toBe(404);
  expect((await call('s1','POST','/v1/team/members',{organizationId,email:users.s1.email,level:'s1'})).status).toBe(400);
  expect((await call('stranger','POST','/v1/team/members',{organizationId,email:users.member.email,level:'s1'})).status).toBe(403);
  expect((await call('stranger','GET',`/v1/team?organizationId=${organizationId}`)).status).toBe(403);
  const mine=await call('member','GET',`/v1/team/mine?organizationId=${organizationId}`);
  expect(mine.body.leaders).toEqual([{level:'s1',email:users.s1.email},{level:'command',email:users.command.email}]);
 });
 it('routes a submission to the member’s own S1, then command, without anyone choosing',async()=>{
  const trip=ok(await send('member','trip.save',crypto.randomUUID(),0,{destination:'Denver, CO',departure:'2026-10-05',returnDate:'2026-10-08',purpose:'Training',timezone:'UTC'}));tripId=trip.id;
  const planning:PlanningModuleInput={traveler:'Team Member',origin:'Austin, TX',travelMode:'air',currency:'USD',approvedExpenseItems:[{id:crypto.randomUUID(),category:'airfare',description:'Round-trip flight',authorizedAmountMinor:43000}]};
  const plan=ok(await send('member','authorization.save',crypto.randomUUID(),0,{tripId,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:planning}));planId=plan.id;
  expect(ok(await send('member','authorization.submit',plan.id,plan.version,{})).status).toBe('in_review');
  const [s1View]=await team('s1');
  expect(s1View).toMatchObject({email:users.member.email,levels:['s1'],waitingOnYou:1});
  expect(s1View!.trips[0]).toMatchObject({destination:'Denver, CO',plannedMinor:43000,approval:{status:'in_review',current:'S1 · Administration',waitingOnYou:true}});
  expect((await team('command'))[0]).toMatchObject({levels:['command'],waitingOnYou:0});
  const request=(await call('s1','GET',`/v1/entities/approval?organizationId=${organizationId}`)).body.entities.find((e:Entity)=>e.data.entityId===planId) as Entity;
  const first=ok(await send('s1','approval.decide',request.id,request.version,{decision:'approved',comment:''}));
  expect((await team('command'))[0]!.trips[0]!.approval).toMatchObject({current:'Command approval',waitingOnYou:true});
  expect(ok(await send('command','approval.decide',request.id,first.version,{decision:'approved',comment:''})).status).toBe('approved');
 });
 it('keeps payments with the traveler and shows them to their leaders only',async()=>{
  expect((await call('member','PUT','/v1/payments',{organizationId,tripId,amountMinor:41250,date:'2026-10-15'})).status).toBe(200);
  expect((await call('stranger','PUT','/v1/payments',{organizationId,tripId,amountMinor:1,date:'2026-10-15'})).status).toBeGreaterThanOrEqual(400);
  expect((await call('member','GET',`/v1/payments?organizationId=${organizationId}`)).body.payments).toEqual({[tripId]:{amountMinor:41250,date:'2026-10-15'}});
  expect((await call('stranger','GET',`/v1/payments?organizationId=${organizationId}`)).body.payments).toEqual({});
  const [person]=await team('s1');
  expect(person!.trips[0]).toMatchObject({paidMinor:41250,payStatus:'paid'});
  expect(person!.totals).toMatchObject({trips:1,plannedMinor:43000,paidMinor:41250});
 });
 it('sends checklists down to the leader’s people and reports their progress',async()=>{
  const steps=[{id:'a',title:'Update DD 93'},{id:'b',title:'Complete PHA'}];
  expect((await call('s1','POST','/v1/team/checklists',{organizationId,title:'Deployment prep',steps,dueOn:'2026-10-18',memberIds:[users.stranger.id]})).status).toBe(403);
  const sent=await call('s1','POST','/v1/team/checklists',{organizationId,title:'Deployment prep',steps,dueOn:'2026-10-18',memberIds:[users.member.id]});
  expect(sent.status).toBe(200);
  const assigned=(await call('member','GET',`/v1/checklists?organizationId=${organizationId}`)).body.checklists;
  expect(assigned).toMatchObject([{title:'Deployment prep',dueOn:'2026-10-18',doneStepIds:[]}]);
  expect((await call('stranger','GET',`/v1/checklists?organizationId=${organizationId}`)).body.checklists).toEqual([]);
  expect((await call('stranger','PUT',`/v1/checklists/${sent.body.checklistId}/progress`,{organizationId,doneStepIds:['a']})).status).toBe(404);
  expect((await call('member','PUT',`/v1/checklists/${sent.body.checklistId}/progress`,{organizationId,doneStepIds:['a']})).status).toBe(200);
  const [person]=await team('s1');
  expect(person!.checklists).toEqual([{id:sent.body.checklistId,title:'Deployment prep',done:1,total:2,dueOn:'2026-10-18'}]);
  expect(person!.overdue).toEqual(expect.arrayContaining([{kind:'checklist_late',label:'Checklist late · Deployment prep',checklistId:sent.body.checklistId}]));
 });
 it('keeps personal workspace state in Supabase and private to its owner',async()=>{
  const saved=await call('member','PUT','/v1/personal-state',{organizationId,key:'preferences',value:{traveler:'Team Member',origin:'Austin, TX'}});
  expect(saved.status,JSON.stringify(saved.body)).toBe(200);
  expect((await call('member','PUT','/v1/personal-state',{organizationId,key:'preferences',value:{largeText:true}})).body.value).toEqual({traveler:'Team Member',origin:'Austin, TX',largeText:true});
  expect((await call('member','GET',`/v1/personal-state?organizationId=${organizationId}&key=preferences`)).body).toMatchObject({exists:true,value:{traveler:'Team Member',origin:'Austin, TX',largeText:true}});
  expect((await call('stranger','GET',`/v1/personal-state?organizationId=${organizationId}&key=preferences`)).body).toMatchObject({exists:false,value:{}});
  expect((await call('outsider','GET',`/v1/personal-state?organizationId=${organizationId}&key=preferences`)).status).toBe(403);
 });
 it('removes someone from a team and leaves other people’s records out of the view',async()=>{
  const stranger=ok(await send('stranger','trip.save',crypto.randomUUID(),0,{destination:'Reno, NV',departure:'2026-11-01',returnDate:'2026-11-02',purpose:'Meeting',timezone:'UTC'}));
  expect(JSON.stringify(await team('s1'))).not.toContain(stranger.id);
  expect((await call('s1','DELETE','/v1/team/members',{organizationId,memberId:users.member.id,level:'s1'})).status).toBe(200);
  expect(await team('s1')).toEqual([]);
  expect((await call('s1','DELETE','/v1/team/members',{organizationId,memberId:users.member.id,level:'s1'})).status).toBe(404);
 });
});
