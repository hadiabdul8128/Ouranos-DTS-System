import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {transitionSaveSchema,transitionPlanSchema,type TransitionPlan} from '../../packages/contracts/transition';
import {recommendTransition,validTransitionProgress} from '../../packages/domain/transition/recommend';
import {requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';

function toPlan(row:Record<string,any>):TransitionPlan{
 return transitionPlanSchema.parse({id:row.id,organizationId:row.organization_id,version:row.version,profile:row.profile,recommendation:row.recommendation,selectedPath:row.selected_path,completedActionIds:row.completed_action_ids,updatedAt:new Date(row.updated_at).toISOString()});
}
export function registerTransitionRoutes(app:FastifyInstance,pool:Pool){
 app.get('/v1/transition/plan',async req=>{
  const {organizationId}=z.object({organizationId:z.string().uuid()}).strict().parse(req.query);
  return withActor(pool,req.actor.id,organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const row=(await db.query('select * from ouranos.transition_plans where organization_id=$1 and user_id=$2',[organizationId,req.actor.id])).rows[0];
   return {plan:row?toPlan(row):null};
  });
 });
 app.put('/v1/transition/plan',async req=>{
  const b=transitionSaveSchema.parse(req.body);
  // Include operation identity so travel-command IDs cannot be reused here.
  const digest=createHash('sha256').update(JSON.stringify({operation:'transition.save',body:b})).digest('hex');
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[b.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const prior=(await db.query('select payload_hash,result from ouranos.processed_commands where organization_id=$1 and command_id=$2',[b.organizationId,b.requestId])).rows[0];
   if(prior){check(prior.payload_hash===digest,'IDEMPOTENCY_CONFLICT','Save request was reused with different content',409);return {plan:transitionPlanSchema.parse(prior.result.plan)}}
   const row=(await db.query('select * from ouranos.transition_plans where organization_id=$1 and user_id=$2 for update',[b.organizationId,req.actor.id])).rows[0];
   check((row?.version||0)===b.expectedVersion,'VERSION_CONFLICT','This plan changed in another tab. Reload the saved plan before editing.',409);
   const profileChanged=!row||JSON.stringify(transitionSaveSchema.shape.profile.parse(row.profile))!==JSON.stringify(b.profile);
   const recommendation=profileChanged?recommendTransition(b.profile):row.recommendation;
   check(validTransitionProgress(recommendation,b.selectedPath,b.completedActionIds),'VALIDATION_FAILED','Completed actions must belong to your selected path');
   check(!profileChanged||b.completedActionIds.length===0,'VALIDATION_FAILED','New answers start a new action plan');
   const saved=(await db.query(`insert into ouranos.transition_plans(id,organization_id,user_id,version,profile,recommendation,selected_path,completed_action_ids)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(organization_id,user_id) do update set
    version=excluded.version,profile=excluded.profile,recommendation=excluded.recommendation,selected_path=excluded.selected_path,completed_action_ids=excluded.completed_action_ids,updated_at=now() returning *`,
    [row?.id||randomUUID(),b.organizationId,req.actor.id,b.expectedVersion+1,JSON.stringify(b.profile),JSON.stringify(recommendation),b.selectedPath,JSON.stringify(b.completedActionIds)])).rows[0];
   const result={plan:toPlan(saved)};
   await db.query('insert into ouranos.processed_commands(organization_id,user_id,command_id,payload_hash,result) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,b.requestId,digest,JSON.stringify(result)]);
   // Audit metadata contains no personal answers or recommendation content.
   await db.query('insert into ouranos.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,'transition.plan.saved',saved.id,{version:saved.version,ruleVersion:recommendation.version}]);
   return result;
  });
 });
}
