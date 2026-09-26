import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool,withActor} from '../shared/database';
import {transitionPlanSchema,type TransitionSave,type TransitionPlan} from '../../packages/contracts/transition';
const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Transition integration tests require local services');
let pool:Pool,app:Awaited<ReturnType<typeof buildApp>>,organizationId:string,owner:{id:string;token:string},peer:{id:string;token:string},outsider:{id:string;token:string};
let plan:TransitionPlan,first:TransitionSave;
const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const userIds:string[]=[];
async function user(){
 const email=`transition-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
 const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;userIds.push(u.data.user.id);
 const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const s=await client.auth.signInWithPassword({email,password});if(s.error)throw s.error;
 return {id:u.data.user.id,token:s.data.session!.access_token};
}
async function request(method:'GET'|'POST'|'PUT',url:string,payload?:unknown,token=owner.token){const r=await app.inject({method,url,payload:payload as object,headers:{authorization:`Bearer ${token}`}});return {status:r.statusCode,body:r.json()}}
beforeAll(async()=>{
 pool=makePool(config);app=await buildApp(config,{pool,logger:false});owner=await user();peer=await user();outsider=await user();
 const org=await request('POST','/v1/organizations',{name:`Transition test ${crypto.randomUUID()}`});expect(org.status).toBe(201);organizationId=org.body.id;
 expect((await request('PUT',`/v1/organizations/${organizationId}/members`,{userId:peer.id,role:'admin',active:true})).status).toBe(200);
 first={organizationId,requestId:crypto.randomUUID(),expectedVersion:0,profile:{stage:'recently_separated',branch:'army',militaryRole:'Logistics specialist',location:'Raleigh, NC',skills:['operations'],interests:'Supply chain',goal:'training',incomeTiming:'soon',housingSupport:false},selectedPath:null,completedActionIds:[]};
},60000);
afterAll(async()=>{
 await app?.close();
 if(pool&&organizationId){await pool.query('delete from ouranos.transition_plans where organization_id=$1',[organizationId]);}
 // Retain immutable audit/command evidence as other integration suites do.
 await pool?.end();
});
function next(overrides:Partial<TransitionSave>={}):TransitionSave{return {...first,requestId:crypto.randomUUID(),expectedVersion:plan.version,profile:plan.profile,selectedPath:plan.selectedPath,completedActionIds:plan.completedActionIds,...overrides}}
describe('private Transition journey',()=>{
 it('starts empty and rejects unauthenticated or malformed writes',async()=>{
  expect((await app.inject({method:'GET',url:`/v1/transition/plan?organizationId=${organizationId}`})).statusCode).toBe(401);
  expect((await request('GET',`/v1/transition/plan?organizationId=${organizationId}`)).body.plan).toBeNull();
  expect((await request('PUT','/v1/transition/plan',{...first,profile:{...first.profile,location:' '}})).status).toBe(400);
  expect((await request('PUT','/v1/transition/plan',{...first,recommendation:{}})).status).toBe(400);
 });
 it('creates server recommendations and safely replays an unchanged lost-response retry',async()=>{
  const saved=await request('PUT','/v1/transition/plan',first);expect(saved.status,JSON.stringify(saved.body)).toBe(200);plan=transitionPlanSchema.parse(saved.body.plan);expect(plan.version).toBe(1);expect(plan.recommendation.paths[0].id).toBe('training');
  const replay=await request('PUT','/v1/transition/plan',first);expect(replay.body.plan).toEqual(plan);
  expect((await request('PUT','/v1/transition/plan',{...first,selectedPath:'education'})).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
 });
 it('rejects stale versions and forged completion without altering the plan',async()=>{
  expect((await request('PUT','/v1/transition/plan',next({expectedVersion:0}))).body.error.code).toBe('VERSION_CONFLICT');
  expect((await request('PUT','/v1/transition/plan',next({completedActionIds:['training.explore']}))).status).toBe(400);
  expect((await request('PUT','/v1/transition/plan',next({selectedPath:'training',completedActionIds:['employment.explore']}))).status).toBe(400);
 });
 it('saves a chosen path, completes its three actions, and resumes on reload',async()=>{
  const r=await request('PUT','/v1/transition/plan',next({selectedPath:'training'}));expect(r.status,JSON.stringify(r.body)).toBe(200);plan=r.body.plan;
  const generatedAt=plan.recommendation.generatedAt;
  for(const action of plan.recommendation.paths.find(p=>p.id==='training')!.actions){const r=await request('PUT','/v1/transition/plan',next({completedActionIds:[...plan.completedActionIds,action.id]}));expect(r.status).toBe(200);plan=r.body.plan}
  expect(plan.completedActionIds).toHaveLength(3);expect(plan.recommendation.generatedAt).toBe(generatedAt);
  expect((await request('GET',`/v1/transition/plan?organizationId=${organizationId}`)).body.plan).toEqual(plan);
 });
 it('regenerates changed answers and prevents carrying stale completion into the new plan',async()=>{
  const profile={...plan.profile,goal:'education' as const,incomeTiming:'flexible' as const};
  expect((await request('PUT','/v1/transition/plan',next({profile}))).status).toBe(400);
  const r=await request('PUT','/v1/transition/plan',next({profile,selectedPath:null,completedActionIds:[]}));expect(r.status).toBe(200);plan=r.body.plan;expect(plan.recommendation.paths[0].id).toBe('education');expect(plan.completedActionIds).toEqual([]);
 });
 it('isolates plans from peers, administrators, other tenants, and travel synchronization',async()=>{
  expect((await request('GET',`/v1/transition/plan?organizationId=${organizationId}`,undefined,peer.token)).body.plan).toBeNull();
  expect((await request('PUT','/v1/transition/plan',next(),peer.token)).body.error.code).toBe('VERSION_CONFLICT');
  expect((await request('GET',`/v1/transition/plan?organizationId=${organizationId}`,undefined,outsider.token)).status).toBe(403);
  expect((await request('PUT','/v1/transition/plan',first,outsider.token)).status).toBe(403);
  const bootstrap=await request('GET',`/v1/sync/bootstrap?organizationId=${organizationId}`);expect(bootstrap.body.entities).toHaveLength(0);
  const peerRows=await withActor(pool,peer.id,organizationId,db=>db.query('select * from ouranos.transition_plans where organization_id=$1',[organizationId]));expect(peerRows.rows).toHaveLength(0);
  const audit=await pool.query("select details from ouranos.audit_events where organization_id=$1 and action='transition.plan.saved'",[organizationId]);expect(audit.rowCount).toBe(6);for(const row of audit.rows)expect(Object.keys(row.details).sort()).toEqual(['ruleVersion','version']);
 });
 it('prevents direct browser database writes and revokes access when membership is inactive',async()=>{
  const db=await pool.connect();try{await db.query('begin');await db.query('set local role authenticated');await expect(db.query('select * from ouranos.transition_plans')).rejects.toMatchObject({code:'42501'});}finally{await db.query('rollback');db.release()}
  await pool.query('update ouranos.memberships set active=false where organization_id=$1 and user_id=$2',[organizationId,owner.id]);
  expect((await request('GET',`/v1/transition/plan?organizationId=${organizationId}`)).status).toBe(403);expect((await request('PUT','/v1/transition/plan',first)).status).toBe(403);
 });
});
