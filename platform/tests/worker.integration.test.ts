import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import pg,{type Pool} from 'pg';
import {readConfig} from '../shared/config';
import {makePool,withActor} from '../shared/database';
import {publishChange} from '../api/entities';
import {runOne} from '../worker/runner';
import type {ReceiptProviders} from '../worker/providers';

const config=readConfig();
for(const endpoint of [config.SUPABASE_URL,config.DATABASE_URL])if(!['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname))throw new Error('Worker integration tests require both Supabase and Postgres to use isolated loopback endpoints');
const organizationId=crypto.randomUUID(),tripId=crypto.randomUUID();
const bytes=Buffer.from('%PDF-1.7\nIsolated worker concurrency fixture\n');
const data={filename:'worker-fixture.pdf',mediaType:'application/pdf',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
// No external scan/OCR endpoints or real uploads are used. Database/Auth are the
// local services, and Storage supplies a deterministic, verified PDF fixture.
const storage={storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null})})}} as unknown as SupabaseClient;
let pool:Pool,admin:SupabaseClient,userId:string;
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return {promise,resolve}}
async function promptly<T>(promise:Promise<T>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Unrelated workspace work was blocked by a provider')),1500)})])}finally{clearTimeout(timer)}}
function providers(modelVersion='worker-fixture-v1'):ReceiptProviders{return {scan:vi.fn(async()=>({clean:true})),extract:vi.fn(async()=>({modelVersion,fields:[{name:'total',value:'18.20',confidence:.99}]}))}}
async function enqueue(id:string,version:number){const jobKey=`receipt:${id}:${version}`;const job={type:'receipt.process',organizationId,entityId:id,jobKey};const messageId=(await pool.query("select pgmq.send('ouranos_jobs',$1::jsonb) as id",[JSON.stringify(job)])).rows[0].id;return {id,jobKey,messageId}}
async function fixture(priorAttempts=0){const id=crypto.randomUUID();await pool.query("insert into ouranos.documents(id,organization_id,trip_id,data,storage_key,status,version,created_by) values($1,$2,$3,$4,$5,'uploaded',2,$6)",[id,organizationId,tripId,data,`${organizationId}/${tripId}/${id}/original`,userId]);const job=await enqueue(id,2);if(priorAttempts)await pool.query('update pgmq.q_ouranos_jobs set read_ct=$2 where msg_id=$1',[job.messageId,priorAttempts]);return job}
async function current(id:string){return (await pool.query('select status,version from ouranos.documents where id=$1',[id])).rows[0]}
const selector=(job:{jobKey:string})=>({organizationId,jobKey:job.jobKey});
async function newerAttempt(id:string){
 // Model an explicit recovery creating a new processing version while an old
 // provider response is still in flight. Publish through the same org lock as
 // API writes, so this also catches workers retaining that lock across I/O.
 const row=await promptly(withActor(pool,userId,organizationId,async db=>{const updated=(await db.query("update ouranos.documents set status='uploaded',version=version+2,updated_at=now() where id=$1 and organization_id=$2 returning *",[id,organizationId])).rows[0];await publishChange(db,'document',updated);return updated}));
 return enqueue(id,row.version);
}
beforeAll(async()=>{
 pool=makePool(config);admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:created,error}=await admin.auth.admin.createUser({email:`worker-${crypto.randomUUID()}@ouranos.test`,password:`Local-${crypto.randomUUID()}!`,email_confirm:true});if(error)throw error;userId=created.user.id;
 await pool.query('insert into ouranos.organizations(id,name,created_by) values($1,$2,$3)',[organizationId,'Worker concurrency fixtures',userId]);
 await pool.query("insert into ouranos.memberships(organization_id,user_id,role) values($1,$2,'admin')",[organizationId,userId]);
 await pool.query('insert into ouranos.trips(id,organization_id,traveler_id,data,created_by) values($1,$2,$3,$4,$3)',[tripId,organizationId,userId,{destination:'Fixture',departure:'2026-10-12',returnDate:'2026-10-13',purpose:'Worker concurrency test'}]);
});
afterAll(async()=>{
 // History tables are deliberately append-only. Keep the synthetic fixture
 // workspace for inspection, as the existing database suite does; archive only
 // this suite's remaining queue messages so a local worker cannot claim them.
 if(pool){try{await pool.query("select pgmq.archive('ouranos_jobs',msg_id) from pgmq.q_ouranos_jobs where message->>'organizationId'=$1",[organizationId])}finally{await pool.end()}}
});

describe('worker claims, provider isolation, and queue fencing',()=>{
 it('processes receipts with the scoped worker role and cannot read unrelated tables',async()=>{
  const workerPool=new pg.Pool({...pool.options,options:'-c role=ouranos_worker'});
  const otherTable=`unrelated_${crypto.randomUUID().replaceAll('-','')}`;
  try{
   await pool.query(`create table public.${otherTable}(id integer)`);
   expect((await workerPool.query('select current_user')).rows[0].current_user).toBe('ouranos_worker');
   expect((await workerPool.query('select has_table_privilege(current_user,$1,\'select\') as allowed',[`public.${otherTable}`])).rows[0].allowed).toBe(false);
   const job=await fixture();
   expect(await runOne(workerPool,storage,config,providers(),selector(job))).toBe(true);
   expect(await current(job.id)).toEqual({status:'needs_review',version:3});
  }finally{await workerPool.end();await pool.query(`drop table if exists public.${otherTable}`)}
 });
 it('allows ordinary workspace access while a receipt provider is waiting',async()=>{
  const job=await fixture(),entered=deferred(),release=deferred(),fake=providers();
  fake.scan=async()=>{entered.resolve();await release.promise;return {clean:true}};
  const work=runOne(pool,storage,config,fake,selector(job));let read:Promise<unknown>|undefined;
  try{
   await promptly(entered.promise);
   read=withActor(pool,userId,organizationId,async db=>(await db.query('select id,status from ouranos.documents where id=$1',[job.id])).rows[0]);
   expect(await promptly(read)).toMatchObject({id:job.id,status:'uploaded'});
  }finally{release.resolve();await work;await read}
  expect(await current(job.id)).toEqual({status:'needs_review',version:3});
 });
 it('deduplicates simultaneous messages and records one extraction and completion',async()=>{
  const job=await fixture(),entered=deferred(),release=deferred(),fake=providers();let calls=0;
  fake.scan=async()=>{calls++;entered.resolve();await release.promise;return {clean:true}};
  const first=runOne(pool,storage,config,fake,selector(job));let duplicate:Awaited<ReturnType<typeof enqueue>>|undefined,second:Promise<boolean>|undefined;
  try{
   await promptly(entered.promise);duplicate=await enqueue(job.id,2);
   second=runOne(pool,storage,config,fake,selector(job));expect(await promptly(second)).toBe(true);expect(calls).toBe(1);
  }finally{release.resolve();await first;await second}
  await pool.query("select pgmq.set_vt('ouranos_jobs',$1::bigint,0)",[duplicate!.messageId]);
  expect(await runOne(pool,storage,config,fake,selector(job))).toBe(true);expect(calls).toBe(1);
  expect((await pool.query('select * from ouranos.extraction_runs where document_id=$1',[job.id])).rowCount).toBe(1);
  expect((await pool.query('select * from ouranos.job_results where job_key=$1',[job.jobKey])).rowCount).toBe(1);
  expect(await current(job.id)).toEqual({status:'needs_review',version:3});
 });
 it('discards a stale successful response after a newer attempt completes',async()=>{
  const job=await fixture(),entered=deferred(),release=deferred(),fake=providers('obsolete-model');
  fake.extract=async()=>{entered.resolve();await release.promise;return {modelVersion:'obsolete-model',fields:[]}};
  const work=runOne(pool,storage,config,fake,selector(job));
  try{await promptly(entered.promise);const newer=await newerAttempt(job.id);expect(await runOne(pool,storage,config,providers('current-model'),selector(newer))).toBe(true)}finally{release.resolve();await work}
  expect(await current(job.id)).toEqual({status:'needs_review',version:5});
  expect((await pool.query('select model_version from ouranos.extraction_runs where document_id=$1',[job.id])).rows).toEqual([{model_version:'current-model'}]);
  expect((await pool.query('select * from ouranos.job_results where job_key=$1',[job.jobKey])).rowCount).toBe(0);
 });
 it('does not let an exhausted stale failure overwrite a newer success',async()=>{
  const job=await fixture(4),entered=deferred(),release=deferred(),fake=providers();
  fake.extract=async()=>{entered.resolve();await release.promise;throw new Error('PROVIDER_HTTP_503')};
  const work=runOne(pool,storage,config,fake,selector(job));
  try{await promptly(entered.promise);const newer=await newerAttempt(job.id);await runOne(pool,storage,config,providers('recovered-model'),selector(newer))}finally{release.resolve();await work}
  expect(await current(job.id)).toEqual({status:'needs_review',version:5});
  expect((await pool.query("select * from ouranos.failed_jobs where message->>'jobKey'=$1",[job.jobKey])).rowCount).toBe(0);
  expect((await pool.query('select model_version from ouranos.extraction_runs where document_id=$1',[job.id])).rows).toEqual([{model_version:'recovered-model'}]);
 });
 it.each(['expired','reclaimed'] as const)('does not publish after its queue lease is %s',async reason=>{
  const job=await fixture(),entered=deferred(),release=deferred(),fake=providers();
  fake.scan=async()=>{entered.resolve();await release.promise;return {clean:true}};
  const work=runOne(pool,storage,config,fake,selector(job));
  try{
   await promptly(entered.promise);
   if(reason==='expired')await pool.query("update pgmq.q_ouranos_jobs set vt=clock_timestamp()-interval '1 second' where msg_id=$1",[job.messageId]);
   else await pool.query("update pgmq.q_ouranos_jobs set read_ct=read_ct+1,vt=clock_timestamp()+interval '120 seconds' where msg_id=$1",[job.messageId]);
  }finally{release.resolve();await work}
  expect(await current(job.id)).toEqual({status:'uploaded',version:2});
  expect((await pool.query('select * from ouranos.extraction_runs where document_id=$1',[job.id])).rowCount).toBe(0);
  expect((await pool.query('select * from ouranos.job_results where job_key=$1',[job.jobKey])).rowCount).toBe(0);
  await pool.query("select pgmq.set_vt('ouranos_jobs',$1::bigint,0)",[job.messageId]);
  await runOne(pool,storage,config,providers(),selector(job));expect(await current(job.id)).toEqual({status:'needs_review',version:3});
 });
 it('publishes a terminal failure only for the current processing version',async()=>{
  const job=await fixture(4),fake=providers();fake.scan=async()=>{throw new Error('PROVIDER_HTTP_503')};
  await runOne(pool,storage,config,fake,selector(job));
  expect(await current(job.id)).toEqual({status:'failed',version:3});
  expect((await pool.query("select error_code from ouranos.failed_jobs where message->>'jobKey'=$1",[job.jobKey])).rows).toEqual([{error_code:'PROVIDER_HTTP_503'}]);
 });
});
