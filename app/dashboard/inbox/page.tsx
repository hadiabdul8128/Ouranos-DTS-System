'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {InboxSprite} from '@/components/inbox/inbox-sprite';
import {ArrowLeft,ArrowUpRight,RefreshCw} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {AuthorizationMessage} from '@/components/inbox/authorization-message';
import {authorizationNoticeSchema,inboxMessages} from '@/packages/contracts/authorization-notice';
import type {LocalRecord} from '@/packages/offline/database';
import type {Entity,Command} from '@/packages/contracts';
import '@/components/inbox/inbox.css';
export default function Inbox(){const p=usePlatform();return <InboxContent key={`${p.organizationId}:${p.session?.user.id}`} />}
function InboxContent(){
 const p=usePlatform(),[selectedId,setSelectedId]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.where('kind').equals('notification').toArray()||Promise.resolve([]),[p.repository]);
 const messages=inboxMessages((rows||[]).map(r=>r.local),p.organizationId,p.session?.user.id);
 const selected=messages.find(n=>n.id===selectedId);
 const parsed=selected?authorizationNoticeSchema.safeParse(selected.data):null;
 const unread=messages.filter(n=>n.status==='unread').length;
 async function open(message:Entity){
  setSelectedId(message.id);setError('');
  if(message.status==='read')return;
  if(!p.client||!p.repository||!p.organizationId||!p.engine){setError('Connect your workspace to mark this message as read.');return}
  setBusy(true);
  try{
   const {entity}=await p.client.get('notification',message.id,p.organizationId);
   if(entity.status==='read'){await p.engine.merge(entity);return}
   let deviceId=(await p.repository.db.meta.get('deviceId'))?.value;
   if(!deviceId){deviceId=crypto.randomUUID();await p.repository.db.meta.put({key:'deviceId',value:deviceId})}
   const command:Command={type:'notification.read',entityId:entity.id,expectedVersion:entity.version,commandId:crypto.randomUUID(),organizationId:p.organizationId,deviceId,schemaVersion:1,payload:{}};
   const result=await p.client.command(command);if(!result.ok)throw new Error(result.error.message);
   if(result.entity.kind!=='notification'||result.entity.id!==message.id)throw new Error('The message could not be updated.');
   await p.engine.merge(result.entity);
  }catch(e){setError(e instanceof Error?e.message:'Unable to mark the message as read.')}finally{setBusy(false)}
 }
 async function refresh(){setBusy(true);setError('');try{await p.engine?.sync()}catch{setError('Unable to refresh your inbox.')}finally{setBusy(false)}}
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link href="/dashboard/travel" className="back-link">Travel system <ArrowUpRight size={15}/></Link></header><section className="cw-shell inbox-shell">
  <Link href="/dashboard" className="back-link"><ArrowLeft size={14}/> Home</Link><div className="inbox-heading"><div><h1>Inbox.</h1><p>{unread?`${unread} unread ${unread===1?'message':'messages'}`:'Your travel updates, in one place.'}</p></div><Button variant="outline" onClick={()=>void refresh()} disabled={busy||!p.engine} aria-label="Refresh inbox"><RefreshCw size={16}/><span>Refresh</span></Button></div>
  {error&&<p role="alert" className="inbox-error">{error} {selected?.status==='unread'&&<button disabled={busy} onClick={()=>void open(selected)}>Retry</button>}</p>}
  {p.sync.state==='offline'&&<p role="status" className="inbox-snapshot-note">Offline · showing messages saved on this device.</p>}
  {rows===undefined?<p role="status">Loading your messages…</p>:messages.length===0?<div className="inbox-empty"><InboxSprite size={28}/><h2>You’re all caught up.</h2><p>When you submit an authorization for review, your confirmation and submitted form will appear here.</p><Link href="/dashboard/travel">Open your trips <ArrowUpRight size={15}/></Link></div>:<div className={`inbox-layout ${selected?'inbox-has-selection':''}`}>
   <nav className="inbox-list" aria-label="Inbox messages">{messages.map(message=>{const notice=authorizationNoticeSchema.safeParse(message.data);return <button key={message.id} type="button" className={`inbox-message-row ${message.status==='unread'?'is-unread':''}`} aria-current={selectedId===message.id?'true':undefined} disabled={busy} onClick={()=>void open(message)}><span className="inbox-row-meta"><span>Ouranos · Travel</span><time dateTime={notice.success?notice.data.submittedAt:message.updatedAt}>{new Date(notice.success?notice.data.submittedAt:message.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</time></span><strong>{String(message.data.title||'Travel update')}{message.status==='unread'&&<span className="inbox-unread-dot" aria-label="Unread"/>}</strong><span className="inbox-preview">{notice.success?`${notice.data.submission.trip.destination} · Sent for review`:'An update about your travel request.'}</span></button>})}</nav>
   <div className="inbox-reader">{selected?<article aria-labelledby="message-title"><button className="back-link inbox-back" onClick={()=>{setSelectedId(null);setError('')}}><ArrowLeft size={14}/> All messages</button><div className="inbox-reader-header"><span>Ouranos · Travel</span><h2 id="message-title">{String(selected.data.title||'Travel update')}</h2><time dateTime={parsed?.success?parsed.data.submittedAt:selected.updatedAt}>{new Date(parsed?.success?parsed.data.submittedAt:selected.updatedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</time></div>{parsed?.success?<AuthorizationMessage notice={parsed.data}/>:<><p className="inbox-snapshot-note">{selected.data.type==='authorization_submitted'?'The submitted details could not be read. Open the authorization to review this request.':'Open your travel workspace to see the details and current status of this request.'}</p>{selected.tripId&&<Link className="inbox-open-plan" href={`/dashboard/travel/planning?tripId=${selected.tripId}`}>View authorization <ArrowUpRight size={16}/></Link>}{p.memberships.some(m=>m.organizationId===p.organizationId&&['reviewer','approver','admin','auditor'].includes(m.role))&&<Link className="inbox-open-plan" href="/dashboard/review">Open review inbox <ArrowUpRight size={16}/></Link>}</>}</article>:<div className="inbox-reader-empty"><InboxSprite size={26}/><p>Select a message to see its details.</p></div>}</div>
  </div>}
 </section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
