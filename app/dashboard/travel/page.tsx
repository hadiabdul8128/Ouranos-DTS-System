'use client';
import {DraftAction,unfinishedDraft} from '@/components/travel/draft-action';
import {InboxLink} from '@/components/inbox/inbox-link';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight,CircleHelp,History,Hotel,Inbox,ListChecks,Plus,Settings,Users} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {OpenSavedPackage} from '@/components/travel/package-panel';
import {useAssignedChecklists} from '@/components/team/assigned-checklists';
import {progressFor,tripHref} from '@/components/travel/trip-timeline';
import {usePayments} from '@/components/travel/use-payments';
import './travel-hub.css';
import {localToday} from '@/packages/domain/flight-search';
import {useState} from 'react';
import type {LocalRecord} from '@/packages/offline/database';
const date=(s:unknown)=>new Date(`${s}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
type Row=LocalRecord;
const nightsBetween=(from:unknown,to:unknown)=>Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86_400_000);

/** Progress as a small ring: how many of the four steps are done, gold while one is in progress. */
function ProgressRing({done,current}:{done:number;current:boolean}){
 const r=7,c=2*Math.PI*r,share=Math.min(done,4)/4;
 return <svg className="trip-ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r={r} className="trip-ring-track"/>{share>0&&<circle cx="9" cy="9" r={r} className={share===1?'trip-ring-done':current?'trip-ring-active':'trip-ring-fill'} strokeDasharray={`${c*share} ${c}`} transform="rotate(-90 9 9)"/>}</svg>;
}

/** One trip as a list row (pattern adapted from the MIT-licensed Circle projects list by ln-dev7, via 21st.dev). */
function TripRow({trip,rows,today,paid}:{trip:Row;rows:Row[];today:string;paid:boolean}){
 const {steps,next}=progressFor(trip.local,rows,paid,today),pages=tripHref(trip.id);
 const href=next.action?pages[next.action.to]:steps.find(step=>step.id==='approval')?.state==='done'?pages.expenses:pages.plan;
 const nights=nightsBetween(trip.local.data.departure,trip.local.data.returnDate);
 const done=steps.filter(step=>step.state==='done').length,current=steps.some(step=>step.state==='current');
 const when=`${date(trip.local.data.departure)} – ${date(trip.local.data.returnDate)}`;
 return <li className="trip-line">
  <Link href={href} className="trip-line-link">
   <span className="trip-line-name"><strong>{String(trip.local.data.destination)}</strong><small className="trip-line-meta">{when}{nights>0?` · ${nights} ${nights===1?'night':'nights'}`:''}</small></span>
   <span className={`trip-line-next ${next.action?'is-action':''}`}>{next.title}{next.action&&<ArrowRight size={14} aria-hidden="true"/>}</span>
   <span className="trip-line-dates">{when}</span>
   <span className="trip-line-progress"><ProgressRing done={done} current={current}/>{done} of 4</span>
  </Link>
  {unfinishedDraft(trip,rows)?<span className="trip-line-extra"><DraftAction trip={trip}/></span>:<span className="trip-line-extra" aria-hidden="true"/>}
 </li>;
}

export default function Travel(){
 const p=usePlatform(),[today]=useState(localToday),{payments}=usePayments(),{checklists}=useAssignedChecklists();const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.toArray()||Promise.resolve([]),[p.repository]);
 const trips=rows?.filter(r=>r.kind==='trip'&&r.local.status!=='cancelled').sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt));const role=p.memberships.find(m=>m.organizationId===p.organizationId)?.role;
 const groups={needs:[] as Row[],waiting:[] as Row[],done:[] as Row[]};
 for(const trip of trips??[]){const {next}=progressFor(trip.local,rows??[],Boolean(payments[trip.id]),today);(next.action?groups.needs:next.title==='All done'?groups.done:groups.waiting).push(trip)}
 // Soonest departure first in the active groups; most recent first once done.
 const byDeparture=(a:Row,b:Row)=>String(a.local.data.departure).localeCompare(String(b.local.data.departure));groups.needs.sort(byDeparture);groups.waiting.sort(byDeparture);groups.done.sort((a,b)=>byDeparture(b,a));
 const openChecklists=(checklists??[]).filter(c=>c.doneStepIds.length<c.steps.length).length;
 const canReview=p.approvalMode!=='preview'&&role&&['reviewer','approver','admin','auditor'].includes(role),leads=role&&['reviewer','approver','admin'].includes(role);
 const row=(trip:Row)=><TripRow key={trip.id} trip={trip} rows={rows??[]} today={today} paid={Boolean(payments[trip.id])}/>;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform" aria-label="Settings"><Settings size={18}/></Link></nav></header><section className="cw-shell travel-hub"><Link className="back-link" href="/dashboard"><ArrowLeft size={14}/> Home</Link><div className="cw-section-heading cw-hub-heading"><h1>Travel</h1><Button asChild><Link href="/dashboard/travel/new"><Plus size={16}/> New trip</Link></Button></div>
 {!p.organizationId&&<Link href="/dashboard/platform">Set up workspace <ArrowRight size={15}/></Link>}
<nav className="travel-hub-shortcuts" aria-labelledby="travel-shortcuts">
   <h2 id="travel-shortcuts" className="sr-only">Shortcuts</h2>
   <ul>
    {canReview&&<li><Link href="/dashboard/inbox"><Inbox size={17} aria-hidden="true"/>Review inbox</Link></li>}
    {leads&&<li><Link href="/dashboard/team"><Users size={17} aria-hidden="true"/>My people</Link></li>}
    {checklists&&checklists.length>0&&<li><Link href="/dashboard/checklists"><ListChecks size={17} aria-hidden="true"/>Checklists{openChecklists>0&&<span className="travel-hub-count">{openChecklists} open</span>}</Link></li>}
    <li><Link href="/dashboard/travel/history"><History size={17} aria-hidden="true"/>Trip history and payments</Link></li>
    <li><Link href="/dashboard/travel/hotels"><Hotel size={17} aria-hidden="true"/>Find hotels</Link></li>
    <li><Link href="/dashboard/help"><CircleHelp size={17} aria-hidden="true"/>Help and how-to guides</Link></li>
   </ul>
  </nav>
 <div className="travel-hub-layout">
  <div className="travel-hub-trips">
   {trips===undefined?<p className="cw-muted" role="status">Loading your trips…</p>:trips.length===0?<div className="travel-hub-empty"><p>No trips yet. Start one with your orders in hand; it takes about a minute.</p><Button asChild variant="outline"><Link href="/dashboard/travel/new"><Plus size={16}/> New trip</Link></Button></div>:<div className="trip-table">
    <div className="trip-table-head" aria-hidden="true"><span>Trip</span><span>Next step</span><span className="trip-line-dates">Dates</span><span className="trip-line-progress">Progress</span></div>
    {groups.needs.length>0&&<section aria-labelledby="trips-needs"><h2 id="trips-needs" className="trip-band">Needs you <span>{groups.needs.length}</span></h2><ul className="trip-lines">{groups.needs.map(row)}</ul></section>}
    {groups.waiting.length>0&&<section aria-labelledby="trips-waiting"><h2 id="trips-waiting" className="trip-band">Waiting <span>{groups.waiting.length}</span></h2><ul className="trip-lines">{groups.waiting.map(row)}</ul></section>}
    {groups.done.length>0&&<details className="travel-hub-done"><summary className="trip-band">Done <span>{groups.done.length}</span></summary><ul className="trip-lines">{groups.done.map(row)}</ul><Link className="travel-hub-more" href="/dashboard/travel/history">All trips and payments <ArrowRight size={15} aria-hidden="true"/></Link></details>}
   </div>}
   <details className="cw-deleted-drafts"><summary>Deleted drafts · {rows?.filter(row=>row.kind==='trip'&&row.local.status==='cancelled').length??0}</summary><p className="cw-muted">Deleted drafts are kept here so you can restore them.</p>{rows?.filter(row=>row.kind==='trip'&&row.local.status==='cancelled').map(trip=><div className="cw-trip-row" key={trip.id}><span>{String(trip.local.data.destination)} · {date(trip.local.data.departure)}</span><DraftAction trip={trip} restore/></div>)}</details><OpenSavedPackage/>
  </div>

 </div></section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
