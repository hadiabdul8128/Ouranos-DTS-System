import type {Entity,Command} from '../contracts/index';
import {OuranosClient,ApiFailure} from '../sdk/index';
import {OuranosDatabase,entityKey} from './database';
export type SyncState={state:'idle'|'syncing'|'offline'|'authentication_required'|'access_denied'|'blocked'|'synced';pending:number;lastSyncedAt?:string;message?:string};
export class SyncEngine {
 private running:Promise<void>|null=null;private stopped=false;private active=false;private timer:ReturnType<typeof setTimeout>|undefined;private failures=0;
 constructor(public db:OuranosDatabase,private client:OuranosClient,private organizationId:string,private emit:(state:SyncState)=>void=()=>{}){}
 async merge(entity:Entity){if(entity.organizationId!==this.organizationId)throw new Error('Invalid synchronization workspace');await this.db.transaction('rw',this.db.entities,this.db.outbox,async()=>{const key=entityKey(entity.kind,entity.id),row=await this.db.entities.get(key);const pending=await this.db.outbox.where('entityKey').equals(key).count();await this.db.entities.put({key,kind:entity.kind,id:entity.id,server:entity,local:pending&&row?row.local:entity})})}
 sync():Promise<void>{
  if(this.stopped)return Promise.resolve();
  if(this.running)return this.running;
  const run=async()=>{if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(`ouranos-sync:${this.db.name}`,()=>this.run());return this.run()};
  this.running=run().finally(()=>{this.running=null});return this.running;
 }
 private async run(){
  if(this.stopped)return;
  try{
   const initialPending=await this.db.outbox.count();if(this.stopped)return;
   this.emit({state:'syncing',pending:initialPending});
   // Replay immutable envelopes first. Successful acknowledgments survive a
   // connection drop because the same command ID is retried on the next run.
   const queued=await this.db.outbox.orderBy('sequence').toArray();const blockedKeys=new Set(queued.filter(q=>q.state==='blocked').map(q=>q.entityKey));
   for(const q of queued){if(this.stopped)return;if(q.state==='blocked'||blockedKeys.has(q.entityKey))continue;
    await this.db.outbox.update(q.sequence!,{attempts:q.attempts+1});if(this.stopped)return;const {results}=await this.client.push([q.command]);const result=results[0];if(!result||result.commandId!==q.commandId)throw new Error('Invalid synchronization acknowledgment');
    if(result.ok){if(result.entity.id!==q.command.entityId||result.entity.kind!==q.command.type.split('.')[0])throw new Error('Invalid synchronization entity');await this.db.transaction('rw',this.db.outbox,this.db.entities,async()=>{await this.db.outbox.delete(q.sequence!);await this.merge(result.entity)})}
    else{if(['AUTHENTICATION_REQUIRED','PROVIDER_UNAVAILABLE','RATE_LIMITED','INTERNAL_ERROR','DEPENDENCY_PENDING'].includes(result.error.code))throw new ApiFailure(result.error.code==='AUTHENTICATION_REQUIRED'?401:503,result.error);await this.db.outbox.update(q.sequence!,{state:'blocked',error:result.error});blockedKeys.add(q.entityKey)}
   }
   if(this.stopped)return;
   await this.uploadFiles();
   if(this.stopped)return;
   // Refresh the full assigned package at reconnection, including changed access.
   // Server-confirmed rows missing from the package are removed; pending drafts
   // remain visibly pending and are never silently discarded.
   const snapshot=await this.client.bootstrap(this.organizationId);if(this.stopped)return;const keys=new Set(snapshot.entities.map(e=>entityKey(e.kind,e.id)));
   await this.db.transaction('rw',this.db.entities,this.db.outbox,this.db.meta,async()=>{
    for(const entity of snapshot.entities)await this.merge(entity);
    for(const row of await this.db.entities.toArray())if(!keys.has(row.key)&&!(await this.db.outbox.where('entityKey').equals(row.key).count()))await this.db.entities.delete(row.key);
    await this.db.meta.put({key:'cursor',value:snapshot.cursor});await this.db.meta.put({key:'lastSyncedAt',value:new Date().toISOString()});
   });
   this.failures=0;const pending=await this.db.outbox.count();const pendingFiles=await this.db.files.where('state').notEqual('uploaded').count();const blocked=await this.db.outbox.where('state').equals('blocked').count();
   if(this.stopped)return;
   this.emit({state:blocked||pendingFiles?'blocked':pending?'idle':'synced',pending:pending+pendingFiles,lastSyncedAt:new Date().toISOString(),message:pendingFiles?'A receipt upload needs attention':blocked?'Review pending changes':''});
  }catch(error){
   if(this.stopped)return;
   this.failures++;const pending=await this.db.outbox.count();if(this.stopped)return;this.emit({state:error instanceof ApiFailure?(error.status===401?'authentication_required':error.status===403?'access_denied':'blocked'):'offline',pending,message:error instanceof ApiFailure?error.message:'Saved on this device. Waiting for a connection to Ouranos.'});
  }
 }
 private async uploadFiles(){
  for(const file of await this.db.files.where('state').equals('pending').toArray()){
   if(this.stopped)return;
   const row=await this.db.entities.get(entityKey('document',file.id));if(!row?.server)continue;
   const metaKey=`finalize:${file.id}`;let saved=(await this.db.meta.get(metaKey))?.value;
   // A finalized response can be lost after the server commits. Replay its
   // immutable command before requesting another URL, which is no longer valid
   // for an already-finalized document.
   if(!saved){
    if(row.server.status!=='registered')continue;
    if(this.stopped)return;
    const upload=await this.client.prepareUpload(file.id,this.organizationId);if(this.stopped)return;
    const response=await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':file.mediaType},body:file.blob,signal:AbortSignal.timeout(60000)});
    // Storage may already contain the immutable object. Finalization checks its
    // actual size/type/hash before accepting it.
    if(!response.ok&&response.status!==400&&response.status!==409)throw new Error('Upload failed');
    if(this.stopped)return;
    const deviceId=(await this.db.meta.get('deviceId'))?.value;
    if(!deviceId)throw new Error('Receipt device identity is unavailable');
    const command:Command={type:'document.finalize',commandId:crypto.randomUUID(),organizationId:this.organizationId,entityId:file.id,deviceId,schemaVersion:1,expectedVersion:row.server.version,payload:{}};
    saved=JSON.stringify(command);await this.db.meta.put({key:metaKey,value:saved});
   }
   if(this.stopped)return;
   const command:Command=JSON.parse(saved);const {results}=await this.client.push([command]);const result=results[0];
   if(!result||result.commandId!==command.commandId)throw new Error('Invalid receipt acknowledgment');
   if(result.ok&&(result.entity.id!==file.id||result.entity.kind!=='document'))throw new Error('Invalid receipt entity');
   if(!result.ok){if(['AUTHENTICATION_REQUIRED','PROVIDER_UNAVAILABLE','RATE_LIMITED','INTERNAL_ERROR','DEPENDENCY_PENDING'].includes(result.error.code))throw new ApiFailure(result.error.code==='AUTHENTICATION_REQUIRED'?401:503,result.error);await this.db.files.update(file.id,{state:'blocked',error:result.error.message});continue}
   await this.db.transaction('rw',this.db.files,this.db.entities,this.db.outbox,async()=>{await this.merge(result.entity);await this.db.files.update(file.id,{state:'uploaded',error:undefined})});
  }
 }
 start(){if(this.active)return()=>this.stop();this.active=true;this.stopped=false;const tick=async()=>{await this.sync();if(!this.stopped)this.timer=setTimeout(tick,Math.min(60000,5000*2**Math.min(this.failures,4))+Math.random()*1000)};void tick();if(typeof window!=='undefined'){window.addEventListener('online',this.onOnline);window.addEventListener('focus',this.onOnline)}return()=>this.stop()}
 private onOnline=()=>{void this.sync()};
 stop():Promise<void>{this.stopped=true;this.active=false;if(this.timer)clearTimeout(this.timer);if(typeof window!=='undefined'){window.removeEventListener('online',this.onOnline);window.removeEventListener('focus',this.onOnline)}return this.running||Promise.resolve()}
}
