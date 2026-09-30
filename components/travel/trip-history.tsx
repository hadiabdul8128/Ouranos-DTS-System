'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowUpRight,Check,CircleDollarSign,Clock,FileWarning} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {InboxLink} from '@/components/inbox/inbox-link';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {usePlanner} from '@/components/planner/store';
import {historyTotals,tripHistory,type TripHistoryEntry} from '@/packages/domain/trip-history';
import {localToday} from '@/packages/domain/flight-search';
import {parseAmountMinor} from '@/packages/contracts/planning-module';
import type {LocalRecord} from '@/packages/offline/database';
import './trip-history.css';

const usd=(minor:number|null)=>minor===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
const day=(value:string,year=true)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',...(year?{year:'numeric'}:{}),timeZone:'UTC'});
const categoryNames:Record<string,string>={airfare:'Airfare',lodging:'Lodging',rental_car:'Rental car',fuel:'Fuel',meals:'Meals & incidentals',parking:'Parking',ground_transport:'Ground transport',baggage:'Baggage',other:'Other'};
const statusNames:Record<string,string>={draft:'Draft',in_review:'In review',approved:'Approved',changes_requested:'Changes requested',rejected:'Not approved',verified:'Verified',needs_action:'Needs action'};
const payLabels:Record<TripHistoryEntry['payStatus'],{text:string;icon:typeof Check}>={paid:{text:'Paid',icon:Check},awaiting:{text:'Awaiting payment',icon:Clock},not_filed:{text:'Voucher not filed',icon:FileWarning},not_due:{text:'Not due yet',icon:Clock}};
type View='past'|'upcoming'|'all';

/** Past and upcoming trips with what was planned, claimed and paid. */
export function TripHistory(){
 const p=usePlatform(),{state,update}=usePlanner(),[today]=useState(localToday);
 const [view,setView]=useState<View>('past'),[year,setYear]=useState('all');
 const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.where('kind').anyOf('trip','authorization','expense','voucher').toArray()||Promise.resolve([]),[p.repository]);
 const all=tripHistory((rows||[]).map(r=>({...r.local,status:r.server?.status||r.local.status})),state.payments,today);
 const years=[...new Set(all.map(t=>t.departure.slice(0,4)))].sort().reverse();
 const shown=all.filter(t=>(view==='all'||(view==='past'?t.phase==='past':t.phase!=='past'))&&(year==='all'||t.departure.startsWith(year)));
 const totals=historyTotals(shown);
 const setPayment=(id:string,payment:{amountMinor:number;date:string}|null)=>update(s=>{const payments={...s.payments};if(payment)payments[id]=payment;else delete payments[id];return {...s,payments}});
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <section className="cw-shell history-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <h1>Trip history.</h1>
   <div className="history-filters">
    <div className="history-tabs" role="tablist" aria-label="Trips to show">{(['past','upcoming','all'] as View[]).map(v=><button key={v} type="button" role="tab" aria-selected={view===v} onClick={()=>setView(v)}>{v==='past'?'Past':v==='upcoming'?'Current & upcoming':'All'}</button>)}</div>
    <label className="history-year">Year<select value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   </div>
   <dl className="history-totals">
    <div><dt>Trips</dt><dd>{totals.trips}</dd><small>{totals.nights} nights</small></div>
    <div><dt>Planned</dt><dd>{usd(totals.plannedMinor)}</dd><small>Authorized budgets</small></div>
    <div><dt>Claimed</dt><dd>{usd(totals.claimedMinor)}</dd><small>Expenses entered</small></div>
    <div><dt>Paid</dt><dd>{usd(totals.paidMinor)}</dd><small>Payments you recorded</small></div>
    <div><dt>Awaiting payment</dt><dd>{usd(totals.awaitingMinor)}</dd><small>Filed, not marked paid</small></div>
   </dl>
   {rows===undefined?<p className="cw-muted" role="status">Loading your trips…</p>:!shown.length?<p className="cw-muted">{view==='past'?'No past trips yet. Trips appear here after their return date.':'No trips here yet.'}</p>:
   <ul className="history-list">{shown.map(trip=><TripCard key={trip.id} trip={trip} today={today} onPayment={payment=>setPayment(trip.id,payment)}/>)}</ul>}
   <p className="history-note">Amounts are in USD; expenses entered in another currency are counted once converted. Ouranos is not connected to DTS or finance, so “Paid” is what you record here, saved on this device.</p>
  </section>
  <footer className="cw-footer"><span/><SyncIndicator/></footer>
 </main>;
}

function TripCard({trip,today,onPayment}:{trip:TripHistoryEntry;today:string;onPayment:(payment:{amountMinor:number;date:string}|null)=>void}){
 const [paying,setPaying]=useState(false),[amount,setAmount]=useState(''),[date,setDate]=useState(''),[error,setError]=useState('');
 const status=payLabels[trip.payStatus],Icon=status.icon;
 function startPaying(){setAmount(((trip.payment?.amountMinor??trip.claimedMinor??trip.plannedMinor??0)/100).toFixed(2));setDate(trip.payment?.date??today);setError('');setPaying(true)}
 function save(e:React.FormEvent){e.preventDefault();try{const amountMinor=parseAmountMinor(amount);if(!date)throw new Error('Choose the date you were paid.');onPayment({amountMinor,date});setPaying(false)}catch(err){setError(err instanceof Error?err.message:'Check the amount.')}}
 return <li className="history-card">
  <header><div><h2>{trip.destination}</h2><p>{day(trip.departure,false)} – {day(trip.returnDate)} · {trip.nights} night{trip.nights===1?'':'s'}{trip.purpose?` · ${trip.purpose}`:''}</p></div><span className={`history-pay is-${trip.payStatus}`}><Icon size={13} aria-hidden="true"/>{status.text}</span></header>
  <dl className="history-amounts"><div><dt>Planned</dt><dd>{usd(trip.plannedMinor)}</dd></div><div><dt>Claimed</dt><dd>{usd(trip.claimedMinor)}</dd></div><div><dt>Paid</dt><dd>{trip.payment?usd(trip.payment.amountMinor):'—'}</dd></div></dl>
  <p className="history-status">Plan: {trip.planStatus?statusNames[trip.planStatus]??trip.planStatus:'Not started'} · Voucher: {trip.voucherStatus?statusNames[trip.voucherStatus]??trip.voucherStatus:'Not started'}{trip.foreignExpenseCount?` · ${trip.foreignExpenseCount} expense${trip.foreignExpenseCount===1?'':'s'} in another currency not counted`:''}{trip.payment?` · Paid ${day(trip.payment.date)}`:''}</p>
  {trip.categories.length>0&&<details className="history-breakdown"><summary>Breakdown</summary><table><thead><tr><th scope="col">Category</th><th scope="col">Planned</th><th scope="col">Claimed</th></tr></thead><tbody>{trip.categories.map(c=><tr key={c.category}><th scope="row">{categoryNames[c.category]??c.category}</th><td>{c.plannedMinor?usd(c.plannedMinor):'—'}</td><td>{c.claimedMinor?usd(c.claimedMinor):'—'}</td></tr>)}</tbody></table></details>}
  {paying?<form className="history-pay-form" onSubmit={save}><label>Amount paid<Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/></label><label>Date paid<Input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}/></label><div><Button type="button" variant="outline" onClick={()=>setPaying(false)}>Cancel</Button><Button type="submit">Save payment</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}</form>:
  <div className="history-actions"><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Plan <ArrowUpRight size={13}/></Link><Link href={`/dashboard/travel/vouchers?tripId=${trip.id}`}>Expenses <ArrowUpRight size={13}/></Link>{trip.phase!=='upcoming'&&(trip.payment?<><button type="button" onClick={startPaying}>Edit payment</button><button type="button" onClick={()=>onPayment(null)}>Remove payment</button></>:<button type="button" className="history-mark" onClick={startPaying}><CircleDollarSign size={14}/> Mark as paid</button>)}</div>}
 </li>;
}
