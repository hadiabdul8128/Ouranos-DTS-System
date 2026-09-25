import {readConfig} from '../shared/config';
import {buildApp} from './app';
const config=readConfig();const app=await buildApp(config);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0)});
await app.listen({host:config.HOST,port:config.PORT});
