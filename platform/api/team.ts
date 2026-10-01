import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {checklistProgressInput,paymentInput,paymentRemoval,teamChecklistInput,teamMemberInput,teamMemberRemoval,teamQuery,type AssignedChecklist} from '../../packages/contracts/team';
import {buildTeamPeople,type TeamPersonRow,type TeamRecordRow} from '../../packages/domain/team-overview';
import {requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';

const LEADER_ROLES=['reviewer','approver','admin'];
const roleOf=async(db:PoolClient,org:string)=>(await db.query('select ouranos.member_role($1) as role',[org])).rows[0].role as string|null;
const utcToday=()=>new Date().toISOString().slice(0,10);

export function registerTeamRoutes(app:FastifyInstance,pool:Pool){
 // Leader overview of the people they added.
 app.get('/v1/team',async req=>{
  const q=teamQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check(LEADER_ROLES.includes((await roleOf(db,q.organizationId))??''),'PERMISSION_DENIED','Only S1, command and admins have a team view',403);
   const people=(await db.query<TeamPersonRow>('select * from ouranos.team_people($1)',[q.organizationId])).rows;
   const records=(await db.query<TeamRecordRow>('select * from ouranos.team_records($1)',[q.organizationId])).rows;
   return {people:buildTeamPeople(people,records,req.actor.id,q.today??utcToday())};
  });
 });
 // A leader adds someone from the workspace at their own level.
 app.post('/v1/team/members',async req=>{
  const b=teamMemberInput.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   const role=await roleOf(db,b.organizationId);
   check(LEADER_ROLES.includes(role??''),'PERMISSION_DENIED','Only S1, command and admins can add people',403);
   check(role==='admin'||(b.level==='s1'?role==='reviewer':role==='approver'),'PERMISSION_DENIED',b.level==='s1'?'Only an S1 reviewer can add people at S1':'Only a command approver can add people at command',403);
   const memberId=(await db.query('select ouranos.member_by_email($1,$2) as id',[b.organizationId,b.email])).rows[0].id as string|null;
   check(memberId,'NOT_FOUND','No one with that email is in this workspace yet. Ask your admin to add them, then try again.',404);
   check(memberId!==req.actor.id,'VALIDATION_FAILED','You can’t add yourself',400);
   await db.query(`insert into ouranos.team_members(organization_id,member_id,level,leader_id,created_by) values($1,$2,$3,$4,$4)
    on conflict(organization_id,member_id,level) do update set leader_id=excluded.leader_id,created_by=excluded.created_by,created_at=now()`,[b.organizationId,memberId,b.level,req.actor.id]);
   await db.query('insert into ouranos.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,'team.member.added',memberId,{level:b.level}]);
   return {memberId,level:b.level};
  });
 });
 app.delete('/v1/team/members',async req=>{
  const b=teamMemberRemoval.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   const removed=(await db.query('delete from ouranos.team_members where organization_id=$1 and member_id=$2 and level=$3 and leader_id=$4',[b.organizationId,b.memberId,b.level,req.actor.id])).rowCount;
   check(removed,'NOT_FOUND','That person isn’t on your team',404);
   await db.query('insert into ouranos.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,'team.member.removed',b.memberId,{level:b.level}]);
   return {removed:true};
  });
 });
 // The caller's own S1 and command.
 app.get('/v1/team/mine',async req=>{
  const q=teamQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check(await roleOf(db,q.organizationId),'PERMISSION_DENIED','Membership required',403);
   return {leaders:(await db.query('select level,email from ouranos.my_leaders($1) order by level desc',[q.organizationId])).rows};
  });
 });
 // Payments the traveler recorded for their own trips.
 app.get('/v1/payments',async req=>{
  const q=teamQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check(await roleOf(db,q.organizationId),'PERMISSION_DENIED','Membership required',403);
   const rows=(await db.query("select trip_id,amount_minor,to_char(paid_on,'YYYY-MM-DD') as paid_on from ouranos.trip_payments where organization_id=$1 and user_id=$2",[q.organizationId,req.actor.id])).rows;
   return {payments:Object.fromEntries(rows.map(r=>[r.trip_id,{amountMinor:Number(r.amount_minor),date:r.paid_on}]))};
  });
 });
 app.put('/v1/payments',async req=>{
  const b=paymentInput.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   await db.query(`insert into ouranos.trip_payments(organization_id,trip_id,user_id,amount_minor,paid_on) values($1,$2,$3,$4,$5)
    on conflict(organization_id,trip_id) do update set amount_minor=excluded.amount_minor,paid_on=excluded.paid_on,updated_at=now()`,[b.organizationId,b.tripId,req.actor.id,b.amountMinor,b.date]);
   return {payment:{amountMinor:b.amountMinor,date:b.date}};
  });
 });
 app.delete('/v1/payments',async req=>{
  const b=paymentRemoval.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   await db.query('delete from ouranos.trip_payments where organization_id=$1 and trip_id=$2 and user_id=$3',[b.organizationId,b.tripId,req.actor.id]);
   return {removed:true};
  });
 });
 // A leader sends a checklist to some of their people.
 app.post('/v1/team/checklists',async req=>{
  const b=teamChecklistInput.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   check(LEADER_ROLES.includes((await roleOf(db,b.organizationId))??''),'PERMISSION_DENIED','Only S1, command and admins can send checklists',403);
   const mine=new Set((await db.query('select member_id from ouranos.team_members where organization_id=$1 and leader_id=$2',[b.organizationId,req.actor.id])).rows.map(r=>r.member_id));
   check(b.memberIds.every(id=>mine.has(id)),'PERMISSION_DENIED','You can only send checklists to people on your team',403);
   const id=randomUUID();
   await db.query('insert into ouranos.team_checklists(id,organization_id,leader_id,title,steps,due_on) values($1,$2,$3,$4,$5,$6)',[id,b.organizationId,req.actor.id,b.title,JSON.stringify(b.steps),b.dueOn??null]);
   for(const memberId of b.memberIds)await db.query('insert into ouranos.checklist_assignments(checklist_id,organization_id,member_id) values($1,$2,$3)',[id,b.organizationId,memberId]);
   await db.query('insert into ouranos.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[b.organizationId,req.actor.id,'team.checklist.sent',id,{people:b.memberIds.length,steps:b.steps.length}]);
   return {checklistId:id};
  });
 });
 // Checklists sent to the caller, and their progress.
 app.get('/v1/checklists',async req=>{
  const q=teamQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check(await roleOf(db,q.organizationId),'PERMISSION_DENIED','Membership required',403);
   const rows=(await db.query(`select c.id,c.title,c.steps,to_char(c.due_on,'YYYY-MM-DD') as due_on,c.created_at,a.done_step_ids from ouranos.checklist_assignments a
    join ouranos.team_checklists c on c.id=a.checklist_id where a.organization_id=$1 and a.member_id=$2 order by c.created_at desc`,[q.organizationId,req.actor.id])).rows;
   const checklists:AssignedChecklist[]=rows.map(r=>({id:r.id,title:r.title,steps:r.steps,dueOn:r.due_on,doneStepIds:r.done_step_ids,createdAt:new Date(r.created_at).toISOString()}));
   return {checklists};
  });
 });
 app.put('/v1/checklists/:id/progress',async req=>{
  const {id}=z.object({id:z.string().uuid()}).strict().parse(req.params);
  const b=checklistProgressInput.parse(req.body);
  return withActor(pool,req.actor.id,b.organizationId,async db=>{
   const updated=(await db.query('update ouranos.checklist_assignments set done_step_ids=$4,updated_at=now() where checklist_id=$1 and organization_id=$2 and member_id=$3',[id,b.organizationId,req.actor.id,JSON.stringify(b.doneStepIds)])).rowCount;
   check(updated,'NOT_FOUND','That checklist wasn’t sent to you',404);
   return {doneStepIds:b.doneStepIds};
  });
 });
}
