'use client';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight,Plus,Settings} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {OpenSavedPackage} from '@/components/travel/package-panel';
import type {LocalRecord} from '@/packages/offline/database';
const date=(s:unknown)=>new Date(`${s}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
export default function Travel(){
 const p=usePlatform();const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.toArray()||Promise.resolve([]),[p.repository]);
 const trips=rows?.filter(r=>r.kind==='trip').sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt));const role=p.memberships.find(m=>m.organizationId===p.organizationId)?.role;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><Link href="/dashboard/platform" aria-label="Settings"><Settings size={18}/></Link></header><section className="cw-shell"><Link className="back-link" href="/dashboard"><ArrowLeft size={14}/> Home</Link><div className="cw-section-heading cw-hub-heading"><h1>Travel.</h1><Button asChild><Link href="/dashboard/travel/new"><Plus size={16}/> New trip</Link></Button></div>{p.approvalMode!=='preview'&&role&&['reviewer','approver','admin','auditor'].includes(role)&&<Link className="cw-inbox-link" href="/dashboard/review">Review inbox <ArrowRight size={15}/></Link>}
 {!p.organizationId&&<Link href="/dashboard/platform">Set up workspace <ArrowRight size={15}/></Link>}
 <div className="cw-trip-list">{trips?.map(trip=>{const auth=rows?.find(r=>r.kind==='authorization'&&r.local.tripId===trip.id&&(p.approvalMode==='preview'||r.local.status==='approved'));const voucher=rows?.filter(r=>r.kind==='voucher'&&r.local.tripId===trip.id).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0];const plan=rows?.filter(r=>r.kind==='authorization'&&r.local.tripId===trip.id).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0];const stage=voucher?.local.status||plan?.local.status||'draft';return <Link key={trip.id} href={`/dashboard/travel/${auth?'vouchers':'planning'}?tripId=${trip.id}`}><div><strong>{String(trip.local.data.destination)}</strong><span>{date(trip.local.data.departure)} — {date(trip.local.data.returnDate)}</span></div><span className="cw-hub-status">{stage==='verified'?'Voucher verified':stage==='needs_action'?'Voucher needs action':stage==='in_review'?'In review':stage==='changes_requested'?'Changes requested':stage==='approved'&&voucher?'Complete':auth?'Add expenses':'Plan'}</span><ArrowRight size={18}/></Link>})}</div>{trips?.length===0&&<p className="cw-muted">Your trips appear here.</p>}<OpenSavedPackage/></section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
