import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {financialSaveSchema,financialPlanSchema,financialProfileSchema,type FinancialPlan} from '../../packages/contracts/financial-readiness';
import {calculateFinancialReadiness} from '../../packages/domain/financial-readiness/calculate';
import {requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';
type FinancialRow={id:string;organization_id:string;user_id:string;version:number;profile:unknown;updated_at:Date|string};
async function toPlan(db:PoolClient,row:FinancialRow):Promise<FinancialPlan>{
 const profile=financialProfileSchema.parse(row.profile);
 const history=(await db.query<{month:string;snapshot:Record<string,unknown>;updated_at:Date}>('select month,snapshot,updated_at from ouranos.financial_check_ins where plan_id=$1 and organization_id=$2 and user_id=$3 order by month desc limit 24',[row.id,row.organization_id,row.user_id])).rows;
 return financialPlanSchema.parse({id:row.id,organizationId:row.organization_id,version:row.version,profile,calculation:calculateFinancialReadiness(profile),checkIns:history.map(h=>({month:h.month,...h.snapshot,updatedAt:new Date(h.updated_at).toISOString()})),updatedAt:new Date(row.updated_at).toISOString()});
}
export function registerFinancialReadinessRoutes(app:FastifyInstance,pool:Pool){
 app.get('/v1/financial-readiness/plan',async req=>{
  const {organizationId}=z.object({organizationId:z.string().uuid()}).strict().parse(req.query);
  return withActor(pool,req.actor.id,organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const row=(await db.query<FinancialRow>('select * from ouranos.financial_plans where organization_id=$1 and user_id=$2',[organizationId,req.actor.id])).rows[0];
   return {plan:row?await toPlan(db,row):null};
  });
 });
 app.put('/v1/financial-readiness/plan',async req=>{
  const b=financialSaveSchema.parse(req.body);
  const digest=createHash('sha256').update(JSON.stringify({operation:'financial-readiness.save',body:b})).digest('hex');
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[b.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const prior=(await db.query('select payload_hash,result from ouranos.processed_commands where organization_id=$1 and command_id=$2',[b.organizationId,b.requestId])).rows[0];
   if(prior){check(prior.payload_hash===digest,'IDEMPOTENCY_CONFLICT','Save request was reused with different content',409);return {plan:financialPlanSchema.parse(prior.result.plan)}}
   const row=(await db.query<FinancialRow>('select * from ouranos.financial_plans where organization_id=$1 and user_id=$2 for update',[b.organizationId,req.actor.id])).rows[0];
   check((row?.version||0)===b.expectedVersion,'VERSION_CONFLICT','This plan changed in another tab. Reload before editing.',409);
   const old=row?financialProfileSchema.parse(row.profile):null;
   check(!old||b.recordCheckIn||(old.goal.balanceMinor===b.profile.goal.balanceMinor&&old.emergency.balanceMinor===b.profile.emergency.balanceMinor&&old.goal.name===b.profile.goal.name),'VALIDATION_FAILED','Confirm a balance check-in when changing balances or the goal name');
   const saved=(await db.query<FinancialRow>(`insert into ouranos.financial_plans(id,organization_id,user_id,version,profile) values($1,$2,$3,$4,$5)
    on conflict(organization_id,user_id) do update set version=excluded.version,profile=excluded.profile,updated_at=now() returning *`,[row?.id||randomUUID(),b.organizationId,req.actor.id,b.expectedVersion+1,JSON.stringify(b.profile)])).rows[0];
   if(!row||b.recordCheckIn){
    const month=new Date().toISOString().slice(0,7);
    await db.query(`insert into ouranos.financial_check_ins(plan_id,organization_id,user_id,month,snapshot) values($1,$2,$3,$4,$5)
     on conflict(plan_id,month) do update set snapshot=excluded.snapshot,updated_at=now()`,[saved.id,b.organizationId,req.actor.id,month,JSON.stringify({goalName:b.profile.goal.name,goalBalanceMinor:b.profile.goal.balanceMinor,emergencyBalanceMinor:b.profile.emergency.balanceMinor})]);
   }
   const result={plan:await toPlan(db,saved)};
   await db.query('insert into ouranos.processed_commands(organization_id,user_id,command_id,payload_hash,result) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,b.requestId,digest,JSON.stringify(result)]);
   await db.query('insert into ouranos.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,'financial.plan.saved',saved.id,{version:saved.version,ruleVersion:result.plan.calculation.ruleVersion,checkIn:!row||b.recordCheckIn}]);
   return result;
  });
 });
}
