'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {usePlatform} from '@/components/platform/provider';
import type {Command} from '@/packages/contracts';
import type {LocalRecord} from '@/packages/offline/database';

export function unfinishedDraft(trip:LocalRecord,rows:LocalRecord[]){
 return ['draft','cancelled'].includes(trip.local.status)&&!rows.some(row=>row.local.tripId===trip.id&&(row.kind==='voucher'||row.kind==='approval'||(row.kind==='authorization'&&(row.server?.status||row.local.status)!=='draft')));
}
export function DraftAction({trip,restore=false}:{trip:LocalRecord;restore?:boolean}){
 const p=usePlatform(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(){
  setBusy(true);setError('');
  try{
   if(!p.client||!p.repository||!p.engine||!p.organizationId)throw new Error('Connect to your workspace to delete or restore drafts.');
   await p.engine.sync();
   const pending=await p.repository.db.outbox.toArray();
   const records=await p.repository.db.entities.toArray();
   const keys=new Set(records.filter(row=>row.id===trip.id||row.local.tripId===trip.id).map(row=>row.key));
   if(pending.some(command=>keys.has(command.entityKey)))throw new Error('Sync this trip’s pending changes before deleting or restoring it.');
   const {entity}=await p.client.get('trip',trip.id,p.organizationId);
   const key='deviceId';let device=(await p.repository.db.meta.get(key))?.value;
   if(!device){device=crypto.randomUUID();await p.repository.db.meta.put({key,value:device})}
   const command:Command={type:restore?'trip.restore':'trip.delete',commandId:crypto.randomUUID(),organizationId:p.organizationId,deviceId:device,entityId:trip.id,expectedVersion:entity.version,schemaVersion:1,payload:{}};
   const result=await p.client.command(command);if(!result.ok)throw new Error(result.error.message);
   await p.engine.merge(result.entity);await p.engine.sync();
  }catch(e){setError(e instanceof Error?e.message:'Unable to update this draft. Try again.')}finally{setBusy(false)}
 }
 return <div className="cw-draft-action"><Button type="button" variant="ghost" disabled={busy} aria-label={`${restore?'Restore':'Delete draft for'} ${String(trip.local.data.destination)}`} onClick={()=>void act()}>{busy?'Saving…':restore?'Restore':'Delete draft'}</Button>{error&&<p className="cw-error" role="alert">{error}</p>}</div>;
}
