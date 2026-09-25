import {readFileSync,writeFileSync,chmodSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parse} from 'dotenv';

const current=parse(readFileSync('.env.platform'));
const local=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
if(current.NODE_ENV==='production'||!local(current.DATABASE_URL)||!local(current.SUPABASE_URL))throw new Error('This setup only activates local development services');
const existing=existsSync('.env.receipts')?parse(readFileSync('.env.receipts')):{};
const token=existing.OURANOS_RECEIPT_TOKEN||randomBytes(32).toString('hex');
if(token.length<32)throw new Error('Existing receipt token is too short');
const serialize=values=>Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
const save=(path,values)=>{writeFileSync(path,serialize(values),{mode:0o600});chmodSync(path,0o600)};
save('.env.receipts',{...existing,OURANOS_RECEIPT_TOKEN:token});
execFileSync('docker',['compose','--env-file','.env.receipts','-f','compose.platform.yml','--profile','receipts','up','--build','--wait','--wait-timeout','240','receipts'],{stdio:'inherit'});
const port=existing.OURANOS_RECEIPT_PORT||'4200';
const connected={...current,SCAN_PROVIDER:'http',SCAN_URL:`http://127.0.0.1:${port}/scan`,SCAN_TOKEN:token,OCR_PROVIDER:'http',OCR_URL:`http://127.0.0.1:${port}/extract`,OCR_TOKEN:token};
save('.env.platform',connected);
const container={...connected};
for(const key of ['DATABASE_URL','SUPABASE_URL']){const url=new URL(container[key]);url.hostname='host.docker.internal';container[key]=url.toString()}
container.SCAN_URL='http://receipts:4200/scan';container.OCR_URL='http://receipts:4200/extract';
save('.env.platform.container',container);
console.log('Local receipt scanning and extraction are active. Restart the API/worker to load the updated configuration.');
console.log('Run npm run platform:doctor to check connections. Secrets are saved only in ignored environment files.');
