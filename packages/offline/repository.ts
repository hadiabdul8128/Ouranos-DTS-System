import {type Command,type CommandType,type PayloadOf,type EntityKind,commandSchema,uuid} from '../contracts/index';
import {OuranosDatabase,entityKey} from './database';
const offlineTypes:CommandType[]=['trip.save','authorization.save','expense.save','voucher.save','document.register'];
export class LocalRepository {
 constructor(public db:OuranosDatabase,public organizationId:string){uuid.parse(organizationId)}
 async stage<T extends CommandType>(type:T,id:string,payload:PayloadOf<T>):Promise<string>{
  if(!offlineTypes.includes(type))throw new Error('This operation requires an online review or explicit submission');
  const kind=type.split('.')[0] as EntityKind,key=entityKey(kind,id),commandId=crypto.randomUUID();
  await this.db.transaction('rw',this.db.entities,this.db.outbox,this.db.meta,async()=>{
   let deviceId=(await this.db.meta.get('deviceId'))?.value;if(!deviceId){deviceId=crypto.randomUUID();await this.db.meta.put({key:'deviceId',value:deviceId})}
   const current=await this.db.entities.get(key);
   const command=commandSchema.parse({type,commandId,entityId:id,organizationId:this.organizationId,deviceId,schemaVersion:1,expectedVersion:current?.local.version||0,payload});
   if(await this.db.outbox.where('entityKey').equals(key).filter(c=>c.state==='blocked').count())throw new Error('Resolve this record’s conflict before editing it');
   await this.db.outbox.add({commandId,entityKey:key,command,state:'pending',attempts:0,createdAt:new Date().toISOString()});
   await this.db.entities.put({key,kind,id,server:current?.server,local:{id,kind,organizationId:this.organizationId,tripId:(payload as any).tripId,version:command.expectedVersion+1,status:kind==='document'?'registered':'draft',data:payload as Record<string,unknown>,updatedAt:new Date().toISOString()}});
  });return commandId;
 }
 async captureReceipt(tripId:string,file:File){
  if(file.size>20*1024*1024)throw new Error('Maximum receipt size is 20 MB');
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type))throw new Error('Use a JPEG, PNG, or PDF');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');const id=crypto.randomUUID();
  // Include entities/outbox/meta/files in one outer transaction: a crash cannot
  // leave a staged document without its bytes, or bytes without a staged record.
  await this.db.transaction('rw',this.db.entities,this.db.outbox,this.db.meta,this.db.files,async()=>{await this.stage('document.register',id,{tripId,filename:file.name,mediaType:file.type as any,byteSize:file.size,sha256});await this.db.files.put({id,blob:file,mediaType:file.type,state:'pending'})});return id;
 }
 async pendingCount(){return this.db.outbox.count()}
 /** Explicit user choice after comparing local and server versions. Never auto-discard. */
 async discardPendingForRecord(kind:EntityKind,id:string){const key=entityKey(kind,id);await this.db.transaction('rw',this.db.outbox,this.db.entities,this.db.files,async()=>{await this.db.outbox.where('entityKey').equals(key).delete();const row=await this.db.entities.get(key);if(row?.server)await this.db.entities.put({...row,local:row.server});else{await this.db.entities.delete(key);if(kind==='document')await this.db.files.delete(id)}})}
 async exportPending(){return JSON.stringify({version:1,organizationId:this.organizationId,commands:await this.db.outbox.toArray()},null,2)}
}
