import {createClient} from '@supabase/supabase-js';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';
import {PLANNING_SCHEMA_VERSION} from '../../packages/contracts/planning-module';
import {VOUCHER_MODULE_SCHEMA_VERSION} from '../../packages/contracts/voucher-module';

const config=readConfig(),pool=makePool(config);
const client=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let failed=false;
async function check(name:string,fn:()=>Promise<unknown>){try{await fn();console.log(`OK    ${name}`)}catch{failed=true;console.log(`FAIL  ${name}`)}}
try{
 await check('Database and workflow migrations',async()=>{await pool.query('select id from ouranos.submission_revisions limit 0');await pool.query("select rolname from pg_roles where rolname='ouranos_api'")});
 await check('Authentication service and server key',async()=>{const {error}=await client.auth.admin.listUsers({page:1,perPage:1});if(error)throw error});
 await check('Private receipt bucket',async()=>{const {data,error}=await client.storage.getBucket('ouranos-documents');if(error||!data||data.public)throw new Error('Invalid bucket')});
 await check('Durable job queue',async()=>{await pool.query('select msg_id from pgmq.q_ouranos_jobs limit 0')});
 for(const [name,mode,url] of [['Receipt scanning',config.SCAN_PROVIDER,config.SCAN_URL],['Receipt extraction',config.OCR_PROVIDER,config.OCR_URL]]){
  if(mode==='disabled'){console.log(`WAIT  ${name}: configure a provider`);continue}
  await check(`${name} readiness`,async()=>{const response=await fetch(new URL('/ready',url!),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Not ready')});
 }
 console.log(`OK    Planning form: ${PLANNING_SCHEMA_VERSION}`);
 console.log(`OK    Voucher form: ${VOUCHER_MODULE_SCHEMA_VERSION}`);
 console.log(`WAIT  External DTS: ${config.DTS_PROVIDER==='mock'?'simulation only':'not connected'}`);
}finally{await pool.end()}
if(failed)process.exitCode=1;
