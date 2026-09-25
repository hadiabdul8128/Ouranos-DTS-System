import {createClient} from '@supabase/supabase-js';
import {readConfig} from '../shared/config';
import {makePool} from '../shared/database';
import {runOne} from './runner';
const config=readConfig(),pool=makePool(config),storage=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let stopped=false;let wake:()=>void=()=>{};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;wake()});
console.log(JSON.stringify({event:'worker_started',ocr:config.OCR_PROVIDER,scanner:config.SCAN_PROVIDER,dts:config.DTS_PROVIDER}));
while(!stopped){try{const worked=await runOne(pool,storage,config);if(!worked)await new Promise<void>(resolve=>{const t=setTimeout(resolve,config.WORKER_POLL_MS);wake=()=>{clearTimeout(t);resolve()}})}catch{console.error(JSON.stringify({event:'worker_unavailable'}));await new Promise(resolve=>setTimeout(resolve,Math.min(10000,config.WORKER_POLL_MS*3)))}}
await pool.end();
