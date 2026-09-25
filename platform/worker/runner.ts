import type {Pool,PoolClient} from 'pg';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import type {PlatformConfig} from '../shared/config';
import {publishChange} from '../api/entities';
import {verifyStoredFile} from '../shared/files';
import {makeProviders,type ReceiptProviders,type Extraction,extractionSchema} from './providers';

const jobSchema=z.object({type:z.enum(['receipt.process','dts.deliver']),organizationId:z.string().uuid(),entityId:z.string().uuid(),jobKey:z.string().min(1)});
const jobSelectorSchema=z.object({organizationId:z.string().uuid(),jobKey:z.string().min(1)}).strict();
type Job=z.infer<typeof jobSchema>;
type Message={msg_id:string;read_ct:number;message:unknown};
type RecordSnapshot={id:string;organization_id:string;trip_id:string;version:number;status:string;storage_key:string;data:Record<string,unknown>};
type Outcome={status:string;blocked:boolean;extraction?:Extraction;data?:Record<string,unknown>};
const leaseSeconds=120;

async function transaction<T>(db:PoolClient,fn:()=>Promise<T>,organizationId?:string):Promise<T>{
 await db.query('begin');
 try{
  if(organizationId)await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[organizationId]);
  const result=await fn();await db.query('commit');return result;
 }catch(error){await db.query('rollback');throw error}
}
// read_ct is the queue's fencing token. Locking the queue row makes checking
// ownership and archiving/defering it one operation, even after a lease expires.
async function ownsMessage(db:PoolClient,message:Message){
 return Boolean((await db.query('select 1 from pgmq.q_ouranos_jobs where msg_id=$1 and read_ct=$2 and vt>clock_timestamp() for update',[message.msg_id,message.read_ct])).rowCount);
}
async function archive(db:PoolClient,message:Message){await db.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id])}
async function completed(db:PoolClient,job:Job){return Boolean((await db.query('select 1 from public.job_results where job_key=$1',[job.jobKey])).rowCount)}
async function loadRecord(db:PoolClient,job:Job):Promise<RecordSnapshot|undefined>{
 const table=job.type==='receipt.process'?'documents':'integration_deliveries';
 return (await db.query(`select * from public.${table} where organization_id=$1 and id=$2 for update`,[job.organizationId,job.entityId])).rows[0];
}
function runnable(job:Job,row:RecordSnapshot){
 return job.type==='receipt.process'
  ?row.status==='uploaded'&&job.jobKey===`receipt:${row.id}:${row.version}`
  :['queued','disabled','failed'].includes(row.status)&&job.jobKey===`dts:${row.id}`;
}
function unchanged(current:RecordSnapshot|undefined,snapshot:RecordSnapshot){return current?.version===snapshot.version&&current.status===snapshot.status}

function maintainLease(db:PoolClient,message:Message){
 let stopped=false,lost=false,timer:ReturnType<typeof setTimeout>|undefined,pending:Promise<void>=Promise.resolve();
 const renew=async()=>{
  try{
   // This is a single autocommit statement; no organization lock or transaction
   // remains open while Storage or the providers are running.
   const result=await db.query("update pgmq.q_ouranos_jobs set vt=clock_timestamp()+make_interval(secs=>$3) where msg_id=$1 and read_ct=$2 and vt>clock_timestamp() returning msg_id",[message.msg_id,message.read_ct,leaseSeconds]);
   if(!result.rowCount)lost=true;
  }catch{lost=true}
  if(!stopped&&!lost)schedule();
 };
 const schedule=()=>{timer=setTimeout(()=>{pending=renew()},30000);timer.unref()};
 schedule();
 return {lost:()=>lost,stop:async()=>{stopped=true;if(timer)clearTimeout(timer);await pending}};
}
async function perform(job:Job,snapshot:RecordSnapshot,storage:SupabaseClient,config:PlatformConfig,injected?:ReceiptProviders):Promise<Outcome>{
 if(job.type==='dts.deliver'){
  // A simulation is never represented as real external-system acceptance.
  const status=config.DTS_PROVIDER==='mock'?'simulated':'disabled';
  return {status,blocked:status==='disabled',data:{externalAccepted:false,providerMode:config.DTS_PROVIDER}};
 }
 const providers=injected||makeProviders(config);
 if(!providers)return {status:'awaiting_provider',blocked:true};
 const bytes=await verifyStoredFile(storage,snapshot);
 const scan=await providers.scan(bytes,String(snapshot.data.mediaType),snapshot.id,`${job.jobKey}:scan`);
 if(!scan.clean)return {status:'quarantined',blocked:false};
 const extraction=extractionSchema.parse(await providers.extract(bytes,String(snapshot.data.mediaType),snapshot.id,`${job.jobKey}:extract`));
 return {status:'needs_review',blocked:false,extraction};
}
function errorCode(error:unknown){
 const supplied=error&&typeof error==='object'&&'code' in error?error.code:undefined;
 return typeof supplied==='string'&&/^[A-Z_0-9]{1,64}$/.test(supplied)?supplied:error instanceof Error&&/^[A-Z_0-9]{1,64}$/.test(error.message)?error.message:'PROCESSING_FAILED';
}

export async function runOne(pool:Pool,storage:SupabaseClient,config:PlatformConfig,injected?:ReceiptProviders,selector?:z.infer<typeof jobSelectorSchema>):Promise<boolean>{
 // Isolated integration runs claim only their own exact queued work.
 const conditional=selector?jobSelectorSchema.parse(selector):{};
 const message:Message|undefined=(await pool.query("select * from pgmq.read('ouranos_jobs',$1,1,$2::jsonb)",[leaseSeconds,JSON.stringify(conditional)])).rows[0];
 if(!message)return false;
 const parsed=jobSchema.safeParse(message.message),db=await pool.connect();
 let jobLock=false,discardConnection=false,snapshot:RecordSnapshot|undefined;
 const job=parsed.success?parsed.data:undefined;
 try{
  if(!job){
   await transaction(db,async()=>{if(!await ownsMessage(db,message))return;await db.query('insert into public.failed_jobs(message,error_code) values($1,$2)',[message.message,'INVALID_JOB']);await archive(db,message)});
   return true;
  }
  // A per-job session lock prevents duplicate provider requests. Unlike the
  // organization lock, it never blocks unrelated reads/writes in the workspace.
  // Worker DATABASE_URL must use a direct/session-pooled Postgres connection.
  jobLock=(await db.query('select pg_try_advisory_lock(hashtextextended($1,0)) as locked',[`ouranos-job:${job.jobKey}`])).rows[0].locked;
  if(!jobLock){
   await transaction(db,async()=>{if(await ownsMessage(db,message))await db.query("select pgmq.set_vt('ouranos_jobs',$1::bigint,5)",[message.msg_id])});
   return true;
  }
  snapshot=await transaction(db,async()=>{
   if(!await ownsMessage(db,message))return;
   if(await completed(db,job)){await archive(db,message);return}
   const row=await loadRecord(db,job);
   if(!row)throw new Error(job.type==='receipt.process'?'DOCUMENT_MISSING':'DELIVERY_MISSING');
   // Receipt job keys identify the exact finalized version. A superseded job
   // never processes the bytes or changes the status of a newer revision.
   if(!runnable(job,row)){await archive(db,message);return}
   return row;
  },job.organizationId);
  if(!snapshot)return true;

  const lease=maintainLease(db,message);
  let outcome:Outcome;
  try{outcome=await perform(job,snapshot,storage,config,injected)}finally{await lease.stop()}
  if(lease.lost())return true;

  await transaction(db,async()=>{
   if(!await ownsMessage(db,message))return;
   if(await completed(db,job)){await archive(db,message);return}
   const current=await loadRecord(db,job);
   if(!unchanged(current,snapshot!)||!runnable(job,current!)){await archive(db,message);return}
   if(outcome.extraction)await db.query('insert into public.extraction_runs(organization_id,document_id,provider,model_version,result) values($1,$2,$3,$4,$5)',[job.organizationId,job.entityId,'http',outcome.extraction.modelVersion,outcome.extraction]);
   const table=job.type==='receipt.process'?'documents':'integration_deliveries';
   const updated=(await db.query(`update public.${table} set status=$3,version=version+1,updated_at=now(),data=data||$4::jsonb where organization_id=$1 and id=$2 and version=$5 returning *`,[job.organizationId,job.entityId,outcome.status,JSON.stringify(outcome.data||{}),snapshot!.version])).rows[0];
   await publishChange(db,job.type==='receipt.process'?'document':'integration',updated);
   await db.query('insert into public.audit_events(organization_id,trip_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[job.organizationId,snapshot!.trip_id,job.type,job.entityId,{jobKey:job.jobKey,blocked:outcome.blocked}]);
   if(!outcome.blocked)await db.query('insert into public.job_results(job_key,result) values($1,$2) on conflict do nothing',[job.jobKey,{processed:true}]);
   await archive(db,message);
  },job.organizationId);
  return true;
 }catch(error){
  if(!job)throw error;
  const code=errorCode(error);
  await transaction(db,async()=>{
   if(!await ownsMessage(db,message))return;
   if(await completed(db,job)){await archive(db,message);return}
   const current=await loadRecord(db,job);
   // A late failed attempt has no authority over newer successful processing.
   if(snapshot&&(!unchanged(current,snapshot)||!runnable(job,current!))){await archive(db,message);return}
   if(message.read_ct>=5){
    await db.query('insert into public.failed_jobs(message,error_code) values($1,$2)',[job,code]);
    if(snapshot){
     const table=job.type==='receipt.process'?'documents':'integration_deliveries';
     const updated=(await db.query(`update public.${table} set status='failed',version=version+1,updated_at=now() where organization_id=$1 and id=$2 and version=$3 returning *`,[job.organizationId,job.entityId,snapshot.version])).rows[0];
     if(updated)await publishChange(db,job.type==='receipt.process'?'document':'integration',updated);
    }
    await archive(db,message);
   }else await db.query("select pgmq.set_vt('ouranos_jobs',$1::bigint,$2)",[message.msg_id,Math.min(300,2**message.read_ct*5)]);
  },job.organizationId);
  console.error(JSON.stringify({event:'job_failed',jobKey:job.jobKey,errorCode:code,attempt:message.read_ct}));return true;
 }finally{
  if(jobLock&&job){try{await db.query('select pg_advisory_unlock(hashtextextended($1,0))',[`ouranos-job:${job.jobKey}`])}catch{discardConnection=true}}
  db.release(discardConnection);
 }
}
