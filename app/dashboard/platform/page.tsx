'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {WorkspaceId} from '@/components/platform/workspace-id';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import type {EntityKind,Role} from '@/packages/contracts';
const roleNames:Record<Role,string>={traveler:'Traveler',reviewer:'S1 reviewer (level 1)',approver:'Command approver (level 2)',admin:'Administrator',auditor:'Auditor'};
import type {PendingCommand} from '@/packages/offline/database';
export default function PlatformSettings(){const p=usePlatform();const [name,setName]=useState('Ouranos Development'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[memberId,setMemberId]=useState(''),[role,setRole]=useState<Role>('traveler'),[discard,setDiscard]=useState<{kind:EntityKind;id:string}|null>(null);
 const pending=useLiveQuery<PendingCommand[]>(()=>p.repository?.db.outbox.toArray()||Promise.resolve([]),[p.repository]);
 const admin=p.memberships.find(m=>m.organizationId===p.organizationId)?.role==='admin';
 async function action(fn:()=>Promise<unknown>){setBusy(true);setMessage('');try{await fn();setMessage('Saved.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to complete action')}finally{setBusy(false)}}

 return <main className="quiet-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link href="/dashboard/travel">Travel</Link></header><section className="platform-panel"><h1>Settings.</h1><div className="platform-block"><SyncIndicator/><Button variant="outline" onClick={()=>void p.engine?.sync()} disabled={!p.engine}>Sync now</Button>{p.sync.message&&<p>{p.sync.message}</p>}{p.error&&<p role="status">{p.error}</p>}</div>
 {p.configured&&<div className="platform-block"><h2>Workspace</h2><details className="cw-disclosure"><summary>Account</summary><p>{p.session?.user.email}</p><p>User ID: <code>{p.session?.user.id}</code></p></details>{p.memberships.length>0?<><label>Organization<select value={p.organizationId||''} onChange={e=>p.setOrganization(e.target.value)}>{p.memberships.map(m=><option key={m.organizationId} value={m.organizationId}>{m.name} · {m.role}</option>)}</select></label>{p.organizationId&&<WorkspaceId id={p.organizationId} demoApproval={p.demoApproval}/>}</>:<form onSubmit={e=>{e.preventDefault();void action(async()=>{await p.client!.createOrganization(name);await p.refresh()})}}><label htmlFor="org-name">Organization name</label><Input id="org-name" value={name} onChange={e=>setName(e.target.value)} required/><Button disabled={busy}>Create workspace</Button></form>}</div>}
 {p.configured&&p.organizationId&&<MyLeaders/>}
 {admin&&p.approvalMode!=='preview'&&<div className="platform-block"><h2>Team access</h2><p className="platform-muted">A teammate signs in first, then shares their user ID. Add their role here.</p><form onSubmit={e=>{e.preventDefault();void action(()=>p.client!.setMember(p.organizationId!,memberId,role))}}><label htmlFor="member-id">Teammate user ID</label><Input id="member-id" value={memberId} onChange={e=>setMemberId(e.target.value)} required/><label>Role<select value={role} onChange={e=>setRole(e.target.value as Role)}>{(Object.keys(roleNames) as Role[]).map(r=><option key={r} value={r}>{roleNames[r]}</option>)}</select></label><Button disabled={busy}>Save team role</Button></form></div>}
 {message&&<p role="status">{message}</p>}
 <details className="cw-disclosure"><summary>Sync details</summary>{pending?.map(q=><div className="platform-record" key={q.commandId}><div><strong>{q.command.type}</strong><p>{q.error?.message||'Waiting to synchronize'}</p></div>{q.state==='blocked'&&<Button variant="outline" onClick={()=>setDiscard({kind:q.command.type.split('.')[0] as EntityKind,id:q.command.entityId})}>Resolve</Button>}</div>)}{!pending?.length&&<p>No pending changes.</p>}<Button variant="outline" onClick={()=>void action(async()=>{const text=await p.repository!.exportPending();const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ouranos-pending-commands.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)})} disabled={!p.repository}>Download pending commands</Button><p className="platform-muted">Receipt files remain on this device.</p></details>
 <Button variant="ghost" onClick={()=>void p.signOut()}>Sign out</Button></section>
 <AlertDialog open={!!discard} onOpenChange={o=>{if(!o)setDiscard(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Use the server version?</AlertDialogTitle><AlertDialogDescription>This removes unsynchronized edits for this record from this device. Download pending commands first if you need to preserve them.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep local changes</AlertDialogCancel><AlertDialogAction onClick={()=>{if(discard)void action(()=>p.repository!.discardPendingForRecord(discard.kind,discard.id));setDiscard(null)}}>Use server version</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </main>
}

/** Who the signed-in person reports to; set by their leaders, never chosen here. */
function MyLeaders(){
 const p=usePlatform(),[leaders,setLeaders]=useState<Array<{level:'s1'|'command';email:string}>|null>(null);
 useEffect(()=>{if(!p.client||!p.organizationId)return;let active=true;void p.client.request<{leaders:Array<{level:'s1'|'command';email:string}>}>(`/v1/team/mine?organizationId=${p.organizationId}`).then(r=>{if(active)setLeaders(r.leaders)}).catch(()=>{if(active)setLeaders([])});return()=>{active=false}},[p.client,p.organizationId]);
 const of=(level:'s1'|'command')=>leaders?.find(l=>l.level===level)?.email;
 return <div className="platform-block"><h2>Your chain of command</h2>
  {leaders===null?<p className="platform-muted">Loading…</p>:<><p>S1 · Administration: <strong>{of('s1')??'Not set yet'}</strong></p><p>Command approval: <strong>{of('command')??'Not set yet'}</strong></p>
  <p className="platform-muted">Your leaders add you to their team; your travel requests then go to them automatically. If this is wrong, ask your S1.</p></>}
 </div>;
}
