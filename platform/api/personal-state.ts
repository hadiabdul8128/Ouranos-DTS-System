import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {personalStateInput,personalStateQuery,personalStateResponse} from '../../packages/contracts/personal-state';
import {requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';

export function registerPersonalStateRoutes(app:FastifyInstance,pool:Pool){
 app.get('/v1/personal-state',async req=>{
  const q=personalStateQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[q.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const row=(await db.query('select value,updated_at from ouranos.personal_state where organization_id=$1 and user_id=$2 and key=$3',[q.organizationId,req.actor.id,q.key])).rows[0];
   return personalStateResponse.parse({key:q.key,value:row?.value??{},exists:Boolean(row),updatedAt:row?new Date(row.updated_at).toISOString():null});
  });
 });
 app.put('/v1/personal-state',async req=>{
  const body=personalStateInput.parse(req.body);
  return withActor(pool,req.actor.id,body.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[body.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const row=(await db.query(`insert into ouranos.personal_state(organization_id,user_id,key,value) values($1,$2,$3,$4)
    on conflict(organization_id,user_id,key) do update set value=case when excluded.key='planner' then excluded.value else ouranos.personal_state.value||excluded.value end,updated_at=now() returning value,updated_at`,[body.organizationId,req.actor.id,body.key,JSON.stringify(body.value)])).rows[0];
   return personalStateResponse.parse({key:body.key,value:row.value,exists:true,updatedAt:new Date(row.updated_at).toISOString()});
  });
 });
}
