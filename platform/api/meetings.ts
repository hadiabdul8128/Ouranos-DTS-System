import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';
import {meetingInput,meetingQuery,type Meeting} from '../../packages/contracts/meetings';
import {canJoinMeeting,meetingRoomName,meetingParticipants} from '../../packages/domain/meetings';
import {requireCondition as check} from '../../packages/domain/errors';
import {withActor} from '../shared/database';
import type {PlatformConfig} from '../shared/config';

type Row={id:string;organization_id:string;organizer_id:string;title:string;starts_at:Date;ends_at:Date;attendee_ids:string[];status:Meeting['status'];created_at:Date};
const dto=(r:Row):Meeting=>({id:r.id,organizationId:r.organization_id,organizerId:r.organizer_id,title:r.title,startsAt:new Date(r.starts_at).toISOString(),endsAt:new Date(r.ends_at).toISOString(),attendeeIds:r.attendee_ids,status:r.status,createdAt:new Date(r.created_at).toISOString()});
export function registerMeetingRoutes(app:FastifyInstance,pool:Pool,config:PlatformConfig){
 const enabled=Boolean(config.LIVEKIT_URL&&config.LIVEKIT_API_KEY&&config.LIVEKIT_API_SECRET);
 const roomService=()=>new RoomServiceClient(config.LIVEKIT_URL!.replace(/^ws/,'http'),config.LIVEKIT_API_KEY,config.LIVEKIT_API_SECRET);
 app.get('/v1/meetings',async req=>{
  const q=meetingQuery.parse(req.query);
  return withActor(pool,req.actor.id,q.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[q.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   return {callingEnabled:enabled,meetings:(await db.query<Row>("select * from ouranos.meetings where organization_id=$1 and ends_at>now()-interval '30 days' order by starts_at limit 200",[q.organizationId])).rows.map(dto)};
  });
 });
 app.post('/v1/meetings',async(req,reply)=>{
  const b=meetingInput.parse(req.body);
  check(Date.parse(b.startsAt)>=Date.now()-60000&&Date.parse(b.endsAt)>Date.now(),'VALIDATION_FAILED','Choose a future time',400);
  const meeting=await withActor(pool,req.actor.id,b.organizationId,async db=>{
   check((await db.query('select ouranos.member_role($1) as role',[b.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
   const attendees:string[]=[];
   for(const email of meetingParticipants(b.attendeeEmails)){
    const id=(await db.query('select ouranos.meeting_member_by_email($1,$2) as id',[b.organizationId,email])).rows[0].id as string|null;
    check(id,'NOT_FOUND',`${email} is not a member of this workspace`,404);
    if(id!==req.actor.id&&!attendees.includes(id))attendees.push(id);
   }
   return dto((await db.query<Row>('insert into ouranos.meetings(id,organization_id,organizer_id,title,starts_at,ends_at,attendee_ids) values($1,$2,$3,$4,$5,$6,$7) returning *',[randomUUID(),b.organizationId,req.actor.id,b.title,b.startsAt,b.endsAt,attendees])).rows[0]!);
  });
  return reply.code(201).send({meeting});
 });
 app.post('/v1/meetings/:id/cancel',async req=>{
  const id=z.string().uuid().parse((req.params as {id:string}).id),b=meetingQuery.parse(req.body);
  const meeting=await withActor(pool,req.actor.id,b.organizationId,async db=>{
   const row=(await db.query<Row>("update ouranos.meetings set status='cancelled' where id=$1 and organization_id=$2 and organizer_id=$3 returning *",[id,b.organizationId,req.actor.id])).rows[0];
   check(row,'NOT_FOUND','Meeting not found or you are not the organizer',404);return dto(row);
  });
  let callEnded=!enabled;
  if(enabled){try{await roomService().deleteRoom(meetingRoomName(meeting));callEnded=true}catch{/* Cancellation blocks new joins; existing connections may remain. */}}
  return {meeting,callEnded};
 });
 app.post('/v1/meetings/:id/token',async req=>{
  const id=z.string().uuid().parse((req.params as {id:string}).id),b=meetingQuery.parse(req.body);
  const meeting=await withActor(pool,req.actor.id,b.organizationId,async db=>{
   const row=(await db.query<Row>('select * from ouranos.meetings where id=$1 and organization_id=$2',[id,b.organizationId])).rows[0];
   check(row,'NOT_FOUND','Meeting not found or you are not invited',404);return dto(row);
  });
  check(canJoinMeeting(meeting),'INVALID_STATE_TRANSITION','This meeting is not open. Join from 15 minutes before its start until its end.',409);
  check(enabled,'PROVIDER_UNAVAILABLE','Calling is not set up for this workspace yet',503);
  const room=meetingRoomName(meeting);
  try{await roomService().createRoom({name:room,maxParticipants:16,emptyTimeout:300,departureTimeout:30})}catch{check(false,'PROVIDER_UNAVAILABLE','The call service could not be reached. Try again.',503)}
  const token=new AccessToken(config.LIVEKIT_API_KEY,config.LIVEKIT_API_SECRET,{identity:req.actor.id,name:req.actor.email||'Workspace member',ttl:'5m'});
  token.addGrant({room,roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:true});
  return {serverUrl:config.LIVEKIT_URL,token:await token.toJwt()};
 });
}
