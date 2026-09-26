import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Pool} from 'pg';
import {buildApp} from '../api/app';
import {readConfig} from '../shared/config';
import {makePool,withActor} from '../shared/database';
import {financialPlanSchema,type FinancialSave,type FinancialPlan} from '../../packages/contracts/financial-readiness';
const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Financial integration tests require local services');
let pool:Pool,app:Awaited<ReturnType<typeof buildApp>>,organizationId:string,owner:{id:string;token:string},peer:{id:string;token:string},outsider:{id:string;token:string},plan:FinancialPlan,first:FinancialSave;
const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function user(){
 const email=`financial-${crypto.randomUUID()}@ouranos.test`,password=`Local-${crypto.randomUUID()}!`;
 const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error)throw u.error;
 const client=createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const s=await client.auth.signInWithPassword({email,password});if(s.error)throw s.error;
 return {id:u.data.user.id,token:s.data.session!.access_token};
}
async function request(method:'GET'|'POST'|'PUT',url:string,payload?:unknown,token=owner.token){const r=await app.inject({method,url,payload:payload as object,headers:{authorization:`Bearer ${token}`}});return {status:r.statusCode,body:r.json()}}
beforeAll(async()=>{
 pool=makePool(config);app=await buildApp(config,{pool,logger:false});owner=await user();peer=await user();outsider=await user();
 const org=await request('POST','/v1/organizations',{name:`Financial test ${crypto.randomUUID()}`});expect(org.status).toBe(201);organizationId=org.body.id;
 expect((await request('PUT',`/v1/organizations/${organizationId}/members`,{userId:peer.id,role:'admin',active:true})).status).toBe(200);
 first={organizationId,requestId:crypto.randomUUID(),expectedVersion:0,recordCheckIn:true,profile:{currency:'USD',takeHomePerPaycheckMinor:171000,cadence:'twice_monthly',tspPerPaycheckMinor:12000,expenses:[{id:crypto.randomUUID(),name:'Bills',monthlyAmountMinor:185000}],monthlySpendingMinor:30000,emergency:{targetMinor:300000,balanceMinor:300000,monthlyContributionMinor:0},goal:{kind:'separation',name:'Separation fund',targetMinor:2500000,balanceMinor:1140000,monthlyContributionMinor:40000,targetMonth:'2027-11'},separationMonth:'2027-11',surplusPriority:'goal_first'}};
},60000);
afterAll(async()=>{await app?.close();if(pool&&organizationId){await pool.query('delete from ouranos.financial_check_ins where organization_id=$1',[organizationId]);await pool.query('delete from ouranos.financial_plans where organization_id=$1',[organizationId])}await pool?.end()});
function next(overrides:Partial<FinancialSave>={}):FinancialSave{return {...first,requestId:crypto.randomUUID(),expectedVersion:plan.version,recordCheckIn:false,profile:plan.profile,...overrides}}
describe('Financial Readiness saved journey',()=>{
 it('starts empty and rejects unauthenticated, malformed, and client-calculated writes',async()=>{
  expect((await app.inject({method:'GET',url:`/v1/financial-readiness/plan?organizationId=${organizationId}`})).statusCode).toBe(401);
  expect((await request('GET',`/v1/financial-readiness/plan?organizationId=${organizationId}`)).body.plan).toBeNull();
  expect((await request('PUT','/v1/financial-readiness/plan',{...first,calculation:{}})).status).toBe(400);
  expect((await request('PUT','/v1/financial-readiness/plan',{...first,profile:{...first.profile,takeHomePerPaycheckMinor:-1}})).status).toBe(400);
 });
 it('saves a server-calculated budget and replays an identical request once',async()=>{
  const r=await request('PUT','/v1/financial-readiness/plan',first);expect(r.status,JSON.stringify(r.body)).toBe(200);plan=financialPlanSchema.parse(r.body.plan);expect(plan.calculation.monthlyTakeHomeMinor).toBe(342000);expect(plan.checkIns).toHaveLength(1);expect(plan.profile.goal.balanceMinor).toBe(1140000);
  expect((await request('PUT','/v1/financial-readiness/plan',first)).body.plan).toEqual(plan);
  expect((await request('PUT','/v1/financial-readiness/plan',{...first,recordCheckIn:false})).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
 });
 it('detects stale edits and requires explicit confirmation for reported balance changes',async()=>{
  expect((await request('PUT','/v1/financial-readiness/plan',next({expectedVersion:0}))).body.error.code).toBe('VERSION_CONFLICT');
  expect((await request('PUT','/v1/financial-readiness/plan',next({profile:{...plan.profile,goal:{...plan.profile.goal,balanceMinor:1200000}}}))).status).toBe(400);
 });
 it('applies saving targets without pretending a transfer or balance increase occurred',async()=>{
  const oldCheckIn=plan.checkIns[0];
  const r=await request('PUT','/v1/financial-readiness/plan',next({profile:{...plan.profile,goal:{...plan.profile.goal,monthlyContributionMinor:100000}}}));expect(r.status).toBe(200);plan=r.body.plan;
  expect(plan.calculation.goalStatus).toBe('on_track');expect(plan.profile.goal.balanceMinor).toBe(1140000);expect(plan.checkIns[0]).toEqual(oldCheckIn);
 });
 it('records actual self-reported progress and reloads it without inferred growth',async()=>{
  const r=await request('PUT','/v1/financial-readiness/plan',next({recordCheckIn:true,profile:{...plan.profile,goal:{...plan.profile.goal,balanceMinor:1200000},emergency:{...plan.profile.emergency,balanceMinor:320000}}}));expect(r.status).toBe(200);plan=r.body.plan;
  expect(plan.checkIns).toHaveLength(1);expect(plan.checkIns[0].goalBalanceMinor).toBe(1200000);expect(plan.calculation.goalProgressPercent).toBe(48);
  const loaded=await request('GET',`/v1/financial-readiness/plan?organizationId=${organizationId}`);expect(loaded.body.plan.profile).toEqual(plan.profile);expect(loaded.body.plan.checkIns).toEqual(plan.checkIns);expect(loaded.body.plan.version).toBe(plan.version);
 });
 it('keeps plans and check-ins invisible to colleagues and other tenants',async()=>{
  expect((await request('GET',`/v1/financial-readiness/plan?organizationId=${organizationId}`,undefined,peer.token)).body.plan).toBeNull();
  expect((await request('GET',`/v1/financial-readiness/plan?organizationId=${organizationId}`,undefined,outsider.token)).status).toBe(403);expect((await request('PUT','/v1/financial-readiness/plan',first,outsider.token)).status).toBe(403);
  const rows=await withActor(pool,peer.id,organizationId,async db=>[await db.query('select * from ouranos.financial_plans where organization_id=$1',[organizationId]),await db.query('select * from ouranos.financial_check_ins where organization_id=$1',[organizationId])]);for(const r of rows)expect(r.rows).toHaveLength(0);
  const bootstrap=await request('GET',`/v1/sync/bootstrap?organizationId=${organizationId}`);expect(bootstrap.body.entities).toHaveLength(0);
  const audit=await pool.query("select details from ouranos.audit_events where organization_id=$1 and action='financial.plan.saved'",[organizationId]);expect(audit.rowCount).toBe(3);for(const r of audit.rows)expect(Object.keys(r.details).sort()).toEqual(['checkIn','ruleVersion','version']);
 });
 it('limits browser and worker roles and revokes inactive membership',async()=>{
  for(const role of ['authenticated','ouranos_worker']){const db=await pool.connect();try{await db.query('begin');await db.query(`set local role ${role}`);await expect(db.query('select * from ouranos.financial_plans')).rejects.toMatchObject({code:'42501'});}finally{await db.query('rollback');db.release()}}
  await pool.query('update ouranos.memberships set active=false where organization_id=$1 and user_id=$2',[organizationId,owner.id]);
  expect((await request('GET',`/v1/financial-readiness/plan?organizationId=${organizationId}`)).status).toBe(403);expect((await request('PUT','/v1/financial-readiness/plan',first)).status).toBe(403);
 });
});
