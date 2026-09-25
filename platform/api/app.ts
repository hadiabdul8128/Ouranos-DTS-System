import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {z,ZodError} from 'zod';
import type {Pool} from 'pg';
import {type PlatformConfig} from '../shared/config';
import {makePool,withActor} from '../shared/database';
import {executeCommand} from './commands';
import {TABLES,loadEntity,toEntity} from './entities';
import {loadApprovedAuthorization} from './approved';
import {loadVoucherPackage} from './package';
import {CONTRACT_VERSION,uuid,entityKindSchema,organizationInput,membershipInput,syncPushSchema,commandSchema} from '../../packages/contracts/index';
import {DomainError,requireCondition as check} from '../../packages/domain/errors';

declare module 'fastify' {interface FastifyRequest{actor:{id:string;email?:string}}}
export async function buildApp(config:PlatformConfig,options:{pool?:Pool;logger?:boolean}={}){
 const app=Fastify({logger:options.logger===false?false:{level:'info',redact:['req.headers.authorization','req.headers.cookie','res.headers.set-cookie']},bodyLimit:2*1024*1024,disableRequestLogging:true,requestTimeout:30000});
 const pool=options.pool||makePool(config);
 const supabase=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 await app.register(cors,{origin:config.ALLOWED_ORIGINS.split(',').map(s=>s.trim()),methods:['GET','POST','PUT','OPTIONS'],allowedHeaders:['Authorization','Content-Type','Idempotency-Key']});
 await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
 app.addHook('onRequest',async(req,reply)=>{reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');if(!req.url.startsWith('/v1/'))return;
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];check(token,'AUTHENTICATION_REQUIRED','Sign in to continue',401);
  const {data,error}=await supabase.auth.getUser(token);check(!error&&data.user,'AUTHENTICATION_REQUIRED','Session expired or invalid',401);req.actor={id:data.user.id,email:data.user.email};
 });
 app.setErrorHandler((error,req,reply)=>{
  if(error instanceof ZodError)return reply.code(400).send({error:{code:'VALIDATION_FAILED',message:'Invalid request',details:error.issues.map(x=>({path:x.path,message:x.message})),requestId:req.id}});
  if(error instanceof DomainError)return reply.code(error.status).send({error:{code:error.code,message:error.message,details:error.details,requestId:req.id}});
  if((error as any).statusCode===429)return reply.code(429).send({error:{code:'RATE_LIMITED',message:'Too many requests',requestId:req.id}});
  // Database messages can contain values; do not put them in logs/responses.
  const pgCode=(error as any).code;
  if(pgCode==='23505')return reply.code(409).send({error:{code:'VERSION_CONFLICT',message:'A conflicting record already exists',requestId:req.id}});
  if(pgCode==='42501')return reply.code(403).send({error:{code:'PERMISSION_DENIED',message:'This action is not permitted',requestId:req.id}});
  app.log.error({requestId:req.id,errorType:error instanceof Error?error.name:'unknown',code:pgCode||'unknown'},'Request failed');
  return reply.code(500).send({error:{code:'INTERNAL_ERROR',message:'The request could not be completed',requestId:req.id}});
 });
 app.get('/health',async()=>({status:'ok',contractVersion:CONTRACT_VERSION}));
 app.get('/ready',async()=>{await pool.query('select 1');return {status:'ready'}});
 app.get('/openapi.json',async(_,reply)=>reply.type('application/json').send(await readFile(new URL('../../docs/openapi.json',import.meta.url),'utf8')));
 app.get('/v1/session',async req=>withActor(pool,req.actor.id,undefined,async db=>({user:req.actor,contractVersion:CONTRACT_VERSION,memberships:(await db.query('select m.organization_id as "organizationId",o.name,m.role from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=$1 and m.active',[req.actor.id])).rows})));
 app.post('/v1/organizations',async(req,reply)=>{const body=organizationInput.parse(req.body);const id=randomUUID();await withActor(pool,req.actor.id,undefined,async db=>db.query('select ouranos.create_organization($1,$2)',[id,body.name]));return reply.code(201).send({id,name:body.name})});
 app.put('/v1/organizations/:id/members',async req=>{
  const org=uuid.parse((req.params as any).id),b=membershipInput.parse(req.body);
  return withActor(pool,req.actor.id,org,async db=>{
   const role=(await db.query('select ouranos.member_role($1) as role',[org])).rows[0].role;check(role==='admin','PERMISSION_DENIED','Administrator access required',403);
   check(b.userId!==req.actor.id,'PERMISSION_DENIED','Self role changes are not allowed',403);
   await db.query('insert into public.memberships(organization_id,user_id,role,active) values($1,$2,$3,$4) on conflict(organization_id,user_id) do update set role=excluded.role,active=excluded.active',[org,b.userId,b.role,b.active]);
   await db.query('insert into public.audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[org,req.actor.id,'membership.changed',b.userId,{role:b.role,active:b.active}]);return {updated:true};
  });
 });
 app.post('/v1/commands',async(req,reply)=>{const command=commandSchema.parse(req.body);const r=await executeCommand(pool,supabase,req.actor.id,command,config.NODE_ENV!=='production');return reply.code(r.ok?200:r.error.code==='VERSION_CONFLICT'?409:r.error.code==='PERMISSION_DENIED'?403:422).send(r)});
 app.post('/v1/sync/push',async req=>{const b=syncPushSchema.parse(req.body);const results=[];for(const c of b.commands)results.push(await executeCommand(pool,supabase,req.actor.id,c,config.NODE_ENV!=='production'));return {results}});
 const querySchema=z.object({organizationId:uuid,cursor:z.string().regex(/^\d+$/).default('0'),limit:z.coerce.number().int().min(1).max(500).default(100)});
 app.get('/v1/sync/pull',async req=>{const q=querySchema.parse(req.query);return withActor(pool,req.actor.id,q.organizationId,async db=>{
  check((await db.query('select ouranos.member_role($1) as role',[q.organizationId])).rows[0].role,'PERMISSION_DENIED','Membership required',403);
  const rows=(await db.query('select * from public.change_log where organization_id=$1 and cursor>$2 order by cursor limit $3',[q.organizationId,q.cursor,q.limit+1])).rows;
  const page=rows.slice(0,q.limit);return {changes:page.map(r=>({cursor:r.cursor,kind:r.kind,entityId:r.entity_id,operation:r.operation,entity:r.entity})),cursor:page.at(-1)?.cursor||q.cursor,hasMore:rows.length>q.limit};
 })});
 app.get('/v1/sync/bootstrap',async req=>{const org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>{
  check((await db.query('select ouranos.member_role($1) as role',[org])).rows[0].role,'PERMISSION_DENIED','Membership required',403);const entities=[];
  for(const [kind,table] of Object.entries(TABLES)){const rows=(await db.query(`select * from public.${table} where organization_id=$1${kind==='notification'?' and user_id=$2':''} order by id limit 2001`,kind==='notification'?[org,req.actor.id]:[org])).rows;check(rows.length<=2000,'DEPENDENCY_PENDING','Workspace exceeds initial offline package limit; narrow the assignment scope',409);entities.push(...rows.map(row=>toEntity(kind as any,row)))}
  const cursor=(await db.query('select coalesce(max(cursor),0)::text as cursor from public.change_log where organization_id=$1',[org])).rows[0].cursor;return {entities,cursor};
 })});
 app.get('/v1/entities/:kind',async req=>{const kind=entityKindSchema.parse((req.params as any).kind),q=querySchema.parse(req.query);return withActor(pool,req.actor.id,q.organizationId,async db=>{const r=await db.query(`select * from public.${TABLES[kind]} where organization_id=$1${kind==='notification'?' and user_id=$3':''} order by updated_at desc,id limit $2`,kind==='notification'?[q.organizationId,q.limit,req.actor.id]:[q.organizationId,q.limit]);return {entities:r.rows.map(row=>toEntity(kind,row))}})});
 app.get('/v1/entities/:kind/:id',async req=>{const p=req.params as any,kind=entityKindSchema.parse(p.kind),id=uuid.parse(p.id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>({entity:toEntity(kind,await loadEntity(db,kind,id,org))}))});
 app.get('/v1/approvals/:id/revision',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>{const a=await loadEntity(db,'approval',id,org);return {revision:(await db.query('select * from public.submission_revisions where id=$1',[a.revision_id])).rows[0],steps:(await db.query('select * from public.approval_steps where request_id=$1 order by position',[id])).rows,decisions:(await db.query('select * from public.approval_decisions where request_id=$1 order by created_at',[id])).rows}})});
 app.get('/v1/authorizations/:id/approved',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>({revision:await loadApprovedAuthorization(db,org,id)}))});
 app.get('/v1/vouchers/:id/package',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,db=>loadVoucherPackage(db,org,id))});
 app.get('/v1/trips/:id/audit',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>{await loadEntity(db,'trip',id,org);return {events:(await db.query('select id,action,actor_id,entity_id,details,created_at from public.audit_events where organization_id=$1 and trip_id=$2 order by id limit 500',[org,id])).rows}})});
 app.post('/v1/documents/:id/upload',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.body as any)?.organizationId);const doc=await withActor(pool,req.actor.id,org,async db=>{const d=await loadEntity(db,'document',id,org);check(d.created_by===req.actor.id&&d.status==='registered','PERMISSION_DENIED','This document cannot be uploaded by this user',403);return d});const {data,error}=await supabase.storage.from('ouranos-documents').createSignedUploadUrl(doc.storage_key,{upsert:false});check(!error&&data,'PROVIDER_UNAVAILABLE','Cannot prepare upload',503);return {documentId:id,path:doc.storage_key,token:data.token,signedUrl:data.signedUrl}});
 app.post('/v1/documents/:id/download',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.body as any)?.organizationId);const doc=await withActor(pool,req.actor.id,org,async db=>{const d=await loadEntity(db,'document',id,org);check(['needs_review','ready'].includes(d.status),'ATTACHMENT_INCOMPLETE','Document has not passed processing checks',409);return d});const {data,error}=await supabase.storage.from('ouranos-documents').createSignedUrl(doc.storage_key,60,{download:doc.data.filename});check(!error&&data,'PROVIDER_UNAVAILABLE','Cannot prepare download',503);return {url:data.signedUrl,expiresIn:60}});
 app.get('/v1/documents/:id/extractions',async req=>{const id=uuid.parse((req.params as any).id),org=uuid.parse((req.query as any).organizationId);return withActor(pool,req.actor.id,org,async db=>{await loadEntity(db,'document',id,org);return {runs:(await db.query('select id,provider,model_version,result,created_at from public.extraction_runs where document_id=$1 order by created_at desc',[id])).rows}})});
 app.addHook('onClose',async()=>{if(!options.pool)await pool.end()});return app;
}
