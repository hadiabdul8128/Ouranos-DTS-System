import type {Pool} from 'pg';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import type {PlatformConfig} from '../shared/config';
import {publishChange} from '../api/entities';
import {verifyStoredFile} from '../shared/files';
import {makeProviders,type ReceiptProviders,extractionSchema} from './providers';
const jobSchema=z.object({type:z.enum(['receipt.process','dts.deliver']),organizationId:z.string().uuid(),entityId:z.string().uuid(),jobKey:z.string().min(1)});
const jobSelectorSchema=z.object({organizationId:z.string().uuid(),jobKey:z.string().min(1)}).strict();
export async function runOne(pool:Pool,storage:SupabaseClient,config:PlatformConfig,injected?:ReceiptProviders,selector?:z.infer<typeof jobSelectorSchema>):Promise<boolean>{
 // A selector lets an isolated integration run claim only its own queued work.
 // Normal workers omit it and retain ordinary queue ordering and visibility.
 const conditional=selector?jobSelectorSchema.parse(selector):{};
 const message=(await pool.query("select * from pgmq.read('ouranos_jobs',120,1,$1::jsonb)",[JSON.stringify(conditional)])).rows[0];if(!message)return false;
 const parsed=jobSchema.safeParse(message.message);
 if(!parsed.success){await pool.query('insert into public.failed_jobs(message,error_code) values($1,$2)',[message.message,'INVALID_JOB']);await pool.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id]);return true}
 const job=parsed.data;const db=await pool.connect();
 try{
  await db.query('begin');await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[job.organizationId]);
  const processed=(await db.query('select 1 from public.job_results where job_key=$1',[job.jobKey])).rowCount;
  if(processed){await db.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id]);await db.query('commit');return true}
  let blocked=false;let tripId:string;
  if(job.type==='receipt.process'){
   const doc=(await db.query('select * from public.documents where organization_id=$1 and id=$2 for update',[job.organizationId,job.entityId])).rows[0];if(!doc)throw new Error('DOCUMENT_MISSING');
   tripId=doc.trip_id;
   if(!['uploaded','awaiting_provider','failed'].includes(doc.status)){await db.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id]);await db.query('commit');return true}
   const providers=injected||makeProviders(config);let status:string;
   if(!providers){status='awaiting_provider';blocked=true}
   else{
    const bytes=await verifyStoredFile(storage,doc);const scan=await providers.scan(bytes,doc.data.mediaType,doc.id,`${job.jobKey}:scan`);
    if(!scan.clean)status='quarantined';
    else{const extracted=extractionSchema.parse(await providers.extract(bytes,doc.data.mediaType,doc.id,`${job.jobKey}:extract`));await db.query('insert into public.extraction_runs(organization_id,document_id,provider,model_version,result) values($1,$2,$3,$4,$5)',[job.organizationId,doc.id,'http',extracted.modelVersion,extracted]);status='needs_review'}
   }
   const row=(await db.query('update public.documents set status=$3,version=version+1,updated_at=now() where organization_id=$1 and id=$2 returning *',[job.organizationId,doc.id,status])).rows[0];await publishChange(db,'document',row);
  }else{
   const row=(await db.query('select * from public.integration_deliveries where organization_id=$1 and id=$2 for update',[job.organizationId,job.entityId])).rows[0];if(!row)throw new Error('DELIVERY_MISSING');
   tripId=row.trip_id;
   // A simulation is never represented as real external-system acceptance.
   const status=config.DTS_PROVIDER==='mock'?'simulated':'disabled';blocked=status==='disabled';
   const updated=(await db.query('update public.integration_deliveries set status=$3,version=version+1,updated_at=now(),data=data||$4::jsonb where organization_id=$1 and id=$2 returning *',[job.organizationId,row.id,status,JSON.stringify({externalAccepted:false,providerMode:config.DTS_PROVIDER})])).rows[0];await publishChange(db,'integration',updated);
  }
  await db.query('insert into public.audit_events(organization_id,trip_id,action,entity_id,details) values($1,$2,$3,$4,$5)',[job.organizationId,tripId,job.type,job.entityId,{jobKey:job.jobKey,blocked}]);
  if(!blocked)await db.query('insert into public.job_results(job_key,result) values($1,$2) on conflict do nothing',[job.jobKey,{processed:true}]);
  await db.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id]);await db.query('commit');return true;
 }catch(error){
  await db.query('rollback');
  const suppliedCode=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  const code=typeof suppliedCode==='string'&&/^[A-Z_0-9]{1,64}$/.test(suppliedCode)?suppliedCode:error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'PROCESSING_FAILED';
  if(message.read_ct>=5){
   await db.query('begin');await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[job.organizationId]);
   await db.query('insert into public.failed_jobs(message,error_code) values($1,$2)',[job,code]);
   const table=job.type==='receipt.process'?'documents':'integration_deliveries';
   const result=await db.query(`update public.${table} set status='failed',version=version+1,updated_at=now() where organization_id=$1 and id=$2 returning *`,[job.organizationId,job.entityId]);
   if(result.rows[0])await publishChange(db,job.type==='receipt.process'?'document':'integration',result.rows[0]);
   await db.query("select pgmq.archive('ouranos_jobs',$1::bigint)",[message.msg_id]);await db.query('commit');
  }else await db.query("select pgmq.set_vt('ouranos_jobs',$1,$2)",[message.msg_id,Math.min(300,2**message.read_ct*5)]);
  console.error(JSON.stringify({event:'job_failed',jobKey:job.jobKey,errorCode:code,attempt:message.read_ct}));return true;
 }finally{db.release()}
}
