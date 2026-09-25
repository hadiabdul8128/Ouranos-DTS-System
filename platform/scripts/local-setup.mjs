import {execFileSync} from 'node:child_process';
import {writeFileSync,chmodSync,existsSync} from 'node:fs';
const status=JSON.parse(execFileSync('supabase',['status','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const required=['API_URL','DB_URL','ANON_KEY','SERVICE_ROLE_KEY'];for(const k of required)if(!status[k])throw new Error(`Supabase status is missing ${k}`);
const loopback=new Set(['127.0.0.1','localhost','[::1]']);
if(!loopback.has(new URL(status.API_URL).hostname)||!loopback.has(new URL(status.DB_URL).hostname))throw new Error('Local setup only accepts loopback Auth and database endpoints');
if(existsSync('.env.platform')&&!process.argv.includes('--replace-local')){console.log('Existing .env.platform preserved. Pass --replace-local to regenerate from the local stack.');process.exit(0)}
writeFileSync('.env.platform',`NODE_ENV=development\nHOST=127.0.0.1\nPORT=4100\nDATABASE_URL=${status.DB_URL}\nDATABASE_SSL=disable\nSUPABASE_URL=${status.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY||status.ANON_KEY}\nSUPABASE_SECRET_KEY=${status.SECRET_KEY||status.SERVICE_ROLE_KEY}\nALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174\nOCR_PROVIDER=disabled\nSCAN_PROVIDER=disabled\nDTS_PROVIDER=disabled\nWORKER_POLL_MS=2000\n`,{mode:0o600});chmodSync('.env.platform',0o600);
if(!existsSync('.env.local')){writeFileSync('.env.local',`NEXT_PUBLIC_OURANOS_API_URL=http://localhost:4100\nNEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY||status.ANON_KEY}\n`,{mode:0o600});chmodSync('.env.local',0o600)}
console.log('Local platform configured. Secrets saved in ignored environment files; no cloud project modified.');
