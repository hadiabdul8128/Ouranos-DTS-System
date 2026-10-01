'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Check} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {InboxLink} from '@/components/inbox/inbox-link';
import type {AssignedChecklist} from '@/packages/contracts/team';
import {localToday} from '@/packages/domain/flight-search';
import './team-page.css';

const day=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});

/** Checklists from the traveler's leaders, loaded once per workspace. */
export function useAssignedChecklists(){
 const p=usePlatform();
 const [checklists,setChecklists]=useState<AssignedChecklist[]|null>(null);
 const load=useCallback(async()=>{
  if(!p.client||!p.organizationId)return;
  try{setChecklists((await p.client.request<{checklists:AssignedChecklist[]}>(`/v1/checklists?organizationId=${p.organizationId}`)).checklists)}catch{setChecklists([])}
 },[p.client,p.organizationId]);
 useEffect(()=>{const timer=setTimeout(()=>void load());return()=>clearTimeout(timer)},[load]);
 return {checklists,setChecklists,reload:load};
}

export function AssignedChecklists(){
 const p=usePlatform(),[today]=useState(localToday),{checklists,setChecklists}=useAssignedChecklists(),[error,setError]=useState('');
 async function toggle(list:AssignedChecklist,stepId:string){
  if(!p.client||!p.organizationId)return;
  const doneStepIds=list.doneStepIds.includes(stepId)?list.doneStepIds.filter(id=>id!==stepId):[...list.doneStepIds,stepId];
  setChecklists(current=>current?.map(c=>c.id===list.id?{...c,doneStepIds}:c)??null);setError('');
  try{await p.client.request(`/v1/checklists/${list.id}/progress`,{method:'PUT',body:JSON.stringify({organizationId:p.organizationId,doneStepIds})})}
  catch(e){setChecklists(current=>current?.map(c=>c.id===list.id?list:c)??null);setError(e instanceof Error?e.message:'Your progress wasn’t saved. Try again.')}
 }
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <section className="cw-shell team-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <h1>Checklists.</h1><p className="team-sub">Sent by your leaders. Check off each step as you finish it; your leader sees your progress.</p>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {checklists===null?<p className="cw-muted" role="status">Loading…</p>:!checklists.length?<p className="team-empty">No checklists from your leaders right now.</p>:
   <ul className="team-people">{checklists.map(list=>{const done=list.doneStepIds.length,late=list.dueOn&&list.dueOn<today&&done<list.steps.length;return <li key={list.id} className="team-person">
    <header><div><h2>{list.title}</h2><p>{done} of {list.steps.length} done{list.dueOn?` · due ${day(list.dueOn)}`:''}</p></div>{done===list.steps.length?<span className="team-flag">Done</span>:late?<span className="team-flag is-late">Late</span>:null}</header>
    <ol className="assigned-steps">{list.steps.map((step,i)=>{const isDone=list.doneStepIds.includes(step.id);return <li key={step.id}><button type="button" aria-pressed={isDone} onClick={()=>void toggle(list,step.id)}><span aria-hidden="true">{isDone?<Check size={13}/>:i+1}</span>{step.title}</button>{step.detail&&<p>{step.detail}</p>}</li>})}</ol>
   </li>})}</ul>}
  </section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}

/** A Travel-page link to checklists from leaders, shown only when there are open ones. */
export function AssignedChecklistsLink(){
 const {checklists}=useAssignedChecklists();
 const open=(checklists??[]).filter(c=>c.doneStepIds.length<c.steps.length).length;
 if(!checklists?.length)return null;
 return <Link className="cw-inbox-link" href="/dashboard/checklists">Checklists from your leaders{open?` (${open} open)`:''} <span aria-hidden="true">→</span></Link>;
}
