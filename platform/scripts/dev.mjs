import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('../../',import.meta.url));
const grouped=process.platform!=='win32';
const services=[
  ['API',['--import','tsx','platform/api/server.ts']],
  ['worker',['--import','tsx','platform/worker/main.ts']],
  ['frontend',['scripts/run-framework.mjs','dev']],
];
const children=new Set();
let shutting=false,forceTimer;

function signalChild(child,signal){
  if(!child.pid)return;
  try{
    // Dedicated POSIX groups also reach Vite/tsx subprocesses. Do not leave
    // listening servers behind after npm or the parent terminal is stopped.
    if(grouped)process.kill(-child.pid,signal);else child.kill(signal);
  }catch(error){if(error.code!=='ESRCH')console.error(`Unable to send ${signal} to a development service`)}
}

function stop(code=0){
  if(shutting)return;
  shutting=true;process.exitCode=code;
  for(const child of children)signalChild(child,'SIGTERM');
  forceTimer=setTimeout(()=>{
    for(const child of children)signalChild(child,'SIGKILL');
  },15000);
  forceTimer.unref();
}

for(const [signal,code] of [['SIGINT',130],['SIGTERM',143],['SIGHUP',129]])process.on(signal,()=>stop(code));

for(const [name,args] of services){
  const child=spawn(process.execPath,args,{cwd,stdio:'inherit',detached:grouped});
  children.add(child);
  child.once('error',error=>{
    console.error(`${name} could not start: ${error.code||'unknown error'}`);
    stop(1);
  });
  child.once('close',(code,signal)=>{
    if(!shutting){
      console.error(`${name} stopped (${signal||`exit ${code}`}); stopping the other services.`);
      stop(code||1);
    }
    children.delete(child);
    if(!children.size&&forceTimer)clearTimeout(forceTimer);
  });
}
