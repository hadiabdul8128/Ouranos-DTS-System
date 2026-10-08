import {describe,it,expect,vi,afterEach} from 'vitest';
import Fastify from 'fastify';
import type {Pool} from 'pg';
import {ZodError} from 'zod';
import {registerMeetingRoutes} from '../api/meetings';
import {DomainError} from '../../packages/domain/errors';
import type {PlatformConfig} from '../shared/config';
const sdk=vi.hoisted(()=>({create:vi.fn(async()=>({})),remove:vi.fn(async()=>({}))}));
vi.mock('livekit-server-sdk',()=>({RoomServiceClient:class{createRoom=sdk.create;deleteRoom=sdk.remove},AccessToken:class{identity:string;grant:unknown;constructor(_k:string,_s:string,options:{identity:string}){this.identity=options.identity}addGrant(g:unknown){this.grant=g}async toJwt(){return JSON.stringify({identity:this.identity,grant:this.grant})}}}));
const org='00000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
const row=()=>({id,organization_id:org,organizer_id:actor,title:'Check-in',starts_at:new Date(Date.now()-60000),ends_at:new Date(Date.now()+3600000),attendee_ids:[],status:'scheduled',created_at:new Date()});
async function setup({visible=true,member=true,cancelled=false,configured=true}={}){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('member_role'))return {rows:[{role:member?'traveler':null}]};
  if(sql.includes('select * from ouranos.meetings'))return {rows:visible?[{...row(),status:cancelled?'cancelled':'scheduled'}]:[]};
  if(sql.includes('insert into ouranos.meetings'))return {rows:[row()]};
  if(sql.includes('update ouranos.meetings'))return {rows:visible?[{...row(),status:'cancelled'}]:[]};
  if(sql.includes('meeting_member_by_email'))return {rows:[{id:null}]};
  return {rows:[]};
 });
 const pool={connect:async()=>({query,release:()=>{}})} as unknown as Pool;
 const app=Fastify();app.addHook('onRequest',async req=>{req.actor={id:actor,email:'member@example.com'}});
 app.setErrorHandler((e,_req,reply)=>{if(e instanceof DomainError)return reply.code(e.status).send({code:e.code});return reply.code(e instanceof ZodError?400:500).send({error:true})});
 registerMeetingRoutes(app,pool,(configured?{LIVEKIT_URL:'wss://calls.example.com',LIVEKIT_API_KEY:'key',LIVEKIT_API_SECRET:'secret'}:{}) as PlatformConfig);
 return {app,query};
}
afterEach(()=>vi.clearAllMocks());
describe('meeting API authorization and tokens',()=>{
 it('does not list meetings for a nonmember',async()=>{const {app}=await setup({member:false});expect((await app.inject(`/v1/meetings?organizationId=${org}`)).statusCode).toBe(403);await app.close()});
 it('does not issue a token for an inaccessible meeting',async()=>{const {app}=await setup({visible:false});expect((await app.inject({method:'POST',url:`/v1/meetings/${id}/token`,payload:{organizationId:org}})).statusCode).toBe(404);expect(sdk.create).not.toHaveBeenCalled();await app.close()});
 it('does not issue a token after cancellation',async()=>{const {app}=await setup({cancelled:true});expect((await app.inject({method:'POST',url:`/v1/meetings/${id}/token`,payload:{organizationId:org}})).statusCode).toBe(409);await app.close()});
 it('reports provider setup instead of inventing a connection',async()=>{const {app}=await setup({configured:false});expect((await app.inject({method:'POST',url:`/v1/meetings/${id}/token`,payload:{organizationId:org}})).statusCode).toBe(503);await app.close()});
 it('derives identity and room on the server and caps participants',async()=>{const {app}=await setup();const r=await app.inject({method:'POST',url:`/v1/meetings/${id}/token`,payload:{organizationId:org}});expect(r.statusCode).toBe(200);expect(JSON.parse(r.json().token)).toEqual({identity:actor,grant:{room:`ouranos-${org}-${id}`,roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:true}});expect(sdk.create).toHaveBeenCalledWith(expect.objectContaining({maxParticipants:16}));await app.close()});
 it('rejects client-provided identities and room grants',async()=>{const {app}=await setup();expect((await app.inject({method:'POST',url:`/v1/meetings/${id}/token`,payload:{organizationId:org,identity:'someone-else',room:'other'}})).statusCode).toBe(400);await app.close()});
 it('can save a meeting without a configured call provider',async()=>{const {app}=await setup({configured:false});const r=await app.inject({method:'POST',url:'/v1/meetings',payload:{organizationId:org,title:'Check-in',startsAt:new Date(Date.now()+60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),attendeeEmails:[]}});expect(r.statusCode).toBe(201);expect(r.json().meeting.id).toBe(id);await app.close()});
 it('rejects invitations to someone outside the workspace',async()=>{const {app}=await setup();const r=await app.inject({method:'POST',url:'/v1/meetings',payload:{organizationId:org,title:'Check-in',startsAt:new Date(Date.now()+60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),attendeeEmails:['unknown@example.com']}});expect(r.statusCode).toBe(404);await app.close()});
 it('rejects cancellation when the organizer update cannot see the row',async()=>{const {app,query}=await setup({visible:false});expect((await app.inject({method:'POST',url:`/v1/meetings/${id}/cancel`,payload:{organizationId:org}})).statusCode).toBe(404);expect(query.mock.calls.some(([sql])=>sql.includes('organizer_id=$3'))).toBe(true);expect(sdk.remove).not.toHaveBeenCalled();await app.close()});
});
