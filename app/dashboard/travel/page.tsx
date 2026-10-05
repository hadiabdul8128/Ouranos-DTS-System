'use client';
import {DraftAction,unfinishedDraft} from '@/components/travel/draft-action';
import {InboxLink} from '@/components/inbox/inbox-link';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight,Plus,Settings} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {OpenSavedPackage} from '@/components/travel/package-panel';
import {AssignedChecklistsLink} from '@/components/team/assigned-checklists';
import {progressFor,tripHref} from '@/components/travel/trip-timeline';
import {usePayments} from '@/components/travel/use-payments';
import {localToday} from '@/packages/domain/flight-search';
import {useState} from 'react';
import type {LocalRecord} from '@/packages/offline/database';
const date=(s:unknown)=>new Date(`${s}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
export default function Travel(){
 const p=usePlatform(),[today]=useState(localToday),{payments}=usePayments();const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.toArray()||Promise.resolve([]),[p.repository]);
 const trips=rows?.filter(r=>r.kind==='trip'&&r.local.status!=='cancelled').sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt));const role=p.memberships.find(m=>m.organizationId===p.organizationId)?.role;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform" aria-label="Settings"><Settings size={18}/></Link></nav></header><section className="cw-shell"><Link className="back-link" href="/dashboard"><ArrowLeft size={14}/> Home</Link><div className="cw-section-heading cw-hub-heading"><h1>Travel</h1><Button asChild><Link href="/dashboard/travel/new"><Plus size={16}/> New trip</Link></Button></div>{p.approvalMode!=='preview'&&role&&['reviewer','approver','admin','auditor'].includes(role)&&<Link className="cw-inbox-link" href="/dashboard/inbox">Review inbox <ArrowRight size={15}/></Link>}
 {!p.organizationId&&<Link href="/dashboard/platform">Set up workspace <ArrowRight size={15}/></Link>}
 {role&&['reviewer','approver','admin'].includes(role)&&<Link className="cw-inbox-link" href="/dashboard/team">My people <ArrowRight size={15}/></Link>}
 <AssignedChecklistsLink/>
 <Link className="cw-inbox-link" href="/dashboard/travel/history">Trip history and payments <ArrowRight size={15}/></Link>
 <Link className="cw-inbox-link" href="/dashboard/travel/hotels">Find hotels for a trip <ArrowRight size={15}/></Link>
 <Link className="cw-inbox-link" href="/dashboard/help">Help and how-to guides <ArrowRight size={15}/></Link>
 <div className="cw-trip-list">{trips?.map(trip=>{const {steps,next}=progressFor(trip.local,rows??[],Boolean(payments[trip.id]),today),pages=tripHref(trip.id);return <div className="cw-trip-row" key={trip.id}><Link href={next.action?pages[next.action.to]:steps.find(step=>step.id==='approval')?.state==='done'?pages.expenses:pages.plan}><div><strong>{String(trip.local.data.destination)}</strong><span>{date(trip.local.data.departure)} — {date(trip.local.data.returnDate)}</span></div><span className="cw-hub-status">{next.title}</span><ArrowRight size={18}/></Link>{unfinishedDraft(trip,rows??[])&&<DraftAction trip={trip}/>}</div>})}</div>{trips?.length===0&&<p className="cw-muted">Your trips appear here.</p>}<details className="cw-deleted-drafts"><summary>Deleted drafts · {rows?.filter(row=>row.kind==='trip'&&row.local.status==='cancelled').length??0}</summary><p className="cw-muted">Deleted drafts are kept here so you can restore them.</p>{rows?.filter(row=>row.kind==='trip'&&row.local.status==='cancelled').map(trip=><div className="cw-trip-row" key={trip.id}><span>{String(trip.local.data.destination)} · {date(trip.local.data.departure)}</span><DraftAction trip={trip} restore/></div>)}</details><OpenSavedPackage/></section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
