import 'fake-indexeddb/auto';
import {describe,it,expect,afterEach,vi} from 'vitest';
import {OuranosDatabase} from '../../packages/offline/database';
import {LocalRepository} from '../../packages/offline/repository';
import {SyncEngine} from '../../packages/offline/sync';
import {OuranosClient} from '../../packages/sdk/index';
import type {Command,Entity} from '../../packages/contracts/index';
const databases:OuranosDatabase[]=[];
const setup=()=>{const db=new OuranosDatabase(crypto.randomUUID());databases.push(db);return {db,repo:new LocalRepository(db,crypto.randomUUID())}};
afterEach(async()=>{for(const db of databases)await db.delete();databases.length=0});
const input={destination:'Boston',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Test',timezone:'UTC'};
describe('offline data and replay',()=>{
 it('persists entity and immutable command atomically',async()=>{const {db,repo}=setup();const id=crypto.randomUUID();await repo.stage('trip.save',id,input);expect(await db.entities.count()).toBe(1);const q=await db.outbox.toArray();expect(q[0].command.expectedVersion).toBe(0);await repo.stage('trip.save',id,{...input,purpose:'Second edit'});expect((await db.outbox.orderBy('sequence').last())!.command.expectedVersion).toBe(1)});
 it('refuses invalid changes without partially saving',async()=>{const {db,repo}=setup();await expect(repo.stage('trip.save',crypto.randomUUID(),{...input,returnDate:'2026-10-01'})).rejects.toThrow();expect(await db.outbox.count()).toBe(0);expect(await db.entities.count()).toBe(0)});
 it('does not drop later edits when an earlier save is acknowledged',async()=>{const {db,repo}=setup();const id=crypto.randomUUID();await repo.stage('trip.save',id,input);await repo.stage('trip.save',id,{...input,purpose:'Keep me'});let call=0;const client={push:vi.fn(async(commands:any[])=>{call++;if(call===2)throw new Error('Disconnected');return {results:[{commandId:commands[0].commandId,ok:true,entity:{id,organizationId:repo.organizationId,kind:'trip',version:1,status:'draft',data:input,updatedAt:new Date().toISOString()}}]}})} as unknown as OuranosClient;await new SyncEngine(db,client,repo.organizationId).sync();expect((await db.entities.get(`trip:${id}`))!.local.data.purpose).toBe('Keep me');expect(await db.outbox.count()).toBe(1)});
 it('keeps failed delivery for retry with the same command id',async()=>{const {db,repo}=setup();await repo.stage('trip.save',crypto.randomUUID(),input);const original=(await db.outbox.toArray())[0];const client={push:vi.fn(async()=>{throw new Error('Offline')})} as unknown as OuranosClient;await new SyncEngine(db,client,repo.organizationId).sync();expect((await db.outbox.toArray())[0].commandId).toBe(original.commandId)});
 it('blocks a conflicting record and preserves the user copy',async()=>{const {db,repo}=setup();const id=crypto.randomUUID();await repo.stage('trip.save',id,input);const client={push:async(c:any[])=>({results:[{commandId:c[0].commandId,ok:false,error:{code:'VERSION_CONFLICT',message:'Conflict'}}]}),bootstrap:async()=>({entities:[],cursor:'0'})} as unknown as OuranosClient;await new SyncEngine(db,client,repo.organizationId).sync();expect((await db.outbox.toArray())[0].state).toBe('blocked');expect((await db.entities.get(`trip:${id}`))!.local.data.purpose).toBe('Test');await expect(repo.stage('trip.save',id,input)).rejects.toThrow('Resolve')});
 it('finishes the in-flight acknowledgment and stops before sending the next record',async()=>{
  const {db,repo}=setup();const first=crypto.randomUUID(),second=crypto.randomUUID();
  await repo.stage('trip.save',first,input);await repo.stage('trip.save',second,input);
  let started!:()=>void,release!:()=>void;
  const requested=new Promise<void>(resolve=>{started=resolve}),released=new Promise<void>(resolve=>{release=resolve});
  const client={push:vi.fn(async(commands:Command[])=>{started();await released;return {results:[{commandId:commands[0].commandId,ok:true,entity:{id:first,organizationId:repo.organizationId,kind:'trip',version:1,status:'draft',data:input,updatedAt:new Date().toISOString()}}]}}),bootstrap:vi.fn()} as unknown as OuranosClient;
  const emit=vi.fn(),engine=new SyncEngine(db,client,repo.organizationId,emit);
  const running=engine.sync();await requested;const stopped=engine.stop(),emissions=emit.mock.calls.length;release();await stopped;await running;
  expect(client.push).toHaveBeenCalledTimes(1);expect(client.bootstrap).not.toHaveBeenCalled();expect(emit).toHaveBeenCalledTimes(emissions);
  expect((await db.outbox.toArray()).map(q=>q.command.entityId)).toEqual([second]);
  await engine.sync();expect(client.push).toHaveBeenCalledTimes(1);
 });
 it('replays lost receipt finalization without asking for another upload URL',async()=>{
  const {db,repo}=setup(),id=crypto.randomUUID();
  const entity:Entity={id,organizationId:repo.organizationId,kind:'document',version:1,status:'registered',data:{filename:'receipt.pdf'},updatedAt:new Date().toISOString()};
  await db.entities.put({key:`document:${id}`,kind:'document',id,server:entity,local:entity});
  await db.files.put({id,blob:new Blob(['receipt']),mediaType:'application/pdf',state:'pending'});
  const finalize:Command={type:'document.finalize',commandId:crypto.randomUUID(),organizationId:repo.organizationId,entityId:id,deviceId:crypto.randomUUID(),schemaVersion:1,expectedVersion:1,payload:{}};
  await db.meta.put({key:`finalize:${id}`,value:JSON.stringify(finalize)});
  const accepted:Entity={...entity,version:2,status:'processing'};
  const client={prepareUpload:vi.fn(async()=>{throw new Error('Already finalized')}),push:vi.fn(async()=>({results:[{commandId:finalize.commandId,ok:true,replayed:true,entity:accepted}]})),bootstrap:async()=>({entities:[accepted],cursor:'2'})} as unknown as OuranosClient;
  await new SyncEngine(db,client,repo.organizationId).sync();
  expect(client.prepareUpload).not.toHaveBeenCalled();expect(client.push).toHaveBeenCalledWith([finalize]);
  expect((await db.files.get(id))?.state).toBe('uploaded');expect((await db.entities.get(`document:${id}`))?.server?.version).toBe(2);
 });
 it('refuses a mismatched acknowledgment without deleting the pending command',async()=>{
  const {db,repo}=setup(),id=crypto.randomUUID();await repo.stage('trip.save',id,input);
  const client={push:async(commands:Command[])=>({results:[{commandId:commands[0].commandId,ok:true,entity:{id,organizationId:crypto.randomUUID(),kind:'trip',version:1,status:'draft',data:input,updatedAt:new Date().toISOString()}}]})} as unknown as OuranosClient;
  await new SyncEngine(db,client,repo.organizationId).sync();
  expect(await db.outbox.count()).toBe(1);expect((await db.entities.get(`trip:${id}`))?.server).toBeUndefined();
 });

 it('retains transiently rejected commands for replay instead of permanently blocking them',async()=>{
  const {db,repo}=setup();await repo.stage('trip.save',crypto.randomUUID(),input);
  const client={push:async(commands:Command[])=>({results:[{commandId:commands[0].commandId,ok:false,error:{code:'PROVIDER_UNAVAILABLE',message:'Try again'}}]})} as unknown as OuranosClient;
  await new SyncEngine(db,client,repo.organizationId).sync();
  expect((await db.outbox.toArray())[0].state).toBe('pending');
 });

});
