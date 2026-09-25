import {spawn} from 'node:child_process';
const children=[['run','platform:api'],['run','platform:worker'],['run','dev']].map(args=>spawn('npm',args,{stdio:'inherit'}));
let shutting=false;function stop(){if(shutting)return;shutting=true;for(const child of children)child.kill('SIGTERM')}
process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const child of children)child.on('exit',code=>{if(code&&!shutting){stop();process.exitCode=code}});
