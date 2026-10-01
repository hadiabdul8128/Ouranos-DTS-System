'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
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
const payLabels:Record<TripHistoryEntry['payStatus'],{text:string}>={paid:{text:'Paid'},awaiting:{text:'Awaiting payment'},not_filed:{text:'Voucher not filed'},not_due:{text:'Upcoming'}};
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
 const range=year==='all'?(years.length>1?`${years[years.length-1]}–${years[0]}`:years[0]??''):year;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <section className="cw-shell claims-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <div className="claims-head">
    <div><h1>Trip history.</h1><p>{totals.trips} {totals.trips===1?'trip':'trips'}{range?`, ${range}`:''} · {totals.nights} nights away</p></div>
    <div className="claims-filters"><div className="claims-tabs" role="group" aria-label="Trips to show">{(['past','upcoming','all'] as View[]).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)}>{v==='past'?'Past':v==='upcoming'?'Upcoming':'All'}</button>)}</div>
     <select aria-label="Year" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
   </div>
   <dl className="claims-totals">
    <div><dt>Planned</dt><dd>{usd(totals.plannedMinor)}</dd></div>
    <div><dt>Claimed</dt><dd>{usd(totals.claimedMinor)}</dd></div>
    <div><dt>Paid to you</dt><dd>{usd(totals.paidMinor)}</dd></div>
    <div><dt>Still owed</dt><dd>{usd(totals.awaitingMinor)}</dd></div>
   </dl>
   {rows===undefined?<p className="cw-muted" role="status">Loading your trips…</p>:!shown.length?<p className="claims-empty">{view==='past'?'No past trips yet. A trip lands here the day after you return.':'Nothing here yet.'}</p>:
   <ol className="claims-list">{shown.map(trip=><TripCard key={trip.id} trip={trip} today={today} onPayment={payment=>setPayment(trip.id,payment)}/>)}</ol>}
   <p className="history-note">Amounts in USD. Ouranos isn’t connected to DTS or finance, so a PAID stamp is a payment you recorded here, on this device.</p>
  </section>
  <footer className="cw-footer"><span/><SyncIndicator/></footer>
 </main>;
}

const stampText:Record<TripHistoryEntry['payStatus'],string>={paid:'Paid',awaiting:'Awaiting pay',not_filed:'Not filed',not_due:'Upcoming'};
const upper=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).toUpperCase();

/** One trip as a travel claim slip, stamped with where its payment stands. */
function TripCard({trip,today,onPayment}:{trip:TripHistoryEntry;today:string;onPayment:(payment:{amountMinor:number;date:string}|null)=>void}){
 const [paying,setPaying]=useState(false),[amount,setAmount]=useState(''),[date,setDate]=useState(''),[error,setError]=useState('');
 function startPaying(){setAmount(((trip.payment?.amountMinor??trip.claimedMinor??trip.plannedMinor??0)/100).toFixed(2));setDate(trip.payment?.date??today);setError('');setPaying(true)}
 function save(e:React.FormEvent){e.preventDefault();try{const amountMinor=parseAmountMinor(amount);if(!date)throw new Error('Choose the date you were paid.');onPayment({amountMinor,date});setPaying(false)}catch(err){setError(err instanceof Error?err.message:'Check the amount.')}}
 const [start,end]=[new Date(`${trip.departure}T12:00:00Z`),new Date(`${trip.returnDate}T12:00:00Z`)];
 const month=(d:Date)=>d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase();
 const dates=start.getUTCMonth()===end.getUTCMonth()?`${start.getUTCDate()}–${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`:`${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`;
 return <li className="slip">
  <span className={`stamp is-${trip.payStatus}`} aria-label={`Status: ${trip.payStatus==='paid'?`paid ${day(trip.payment!.date)}`:payLabels[trip.payStatus].text}`}>{stampText[trip.payStatus]}{trip.payStatus==='paid'&&<small>{upper(trip.payment!.date)}</small>}</span>
  <div className="slip-grid">
   <div className="box box-wide"><span>Destination</span><strong>{trip.destination}</strong></div>
   <div className="box"><span>Dates</span><strong>{dates}</strong></div>
   <div className="box"><span>Purpose</span><strong>{trip.purpose||'—'}</strong></div>
   <div className="box"><span>Nights</span><strong>{trip.nights}</strong></div>
   <div className="box"><span>Planned</span><strong>{usd(trip.plannedMinor)}</strong></div>
   <div className="box"><span>Claimed</span><strong>{usd(trip.claimedMinor)}</strong></div>
   <div className="box"><span>Paid</span><strong>{trip.payment?usd(trip.payment.amountMinor):'—'}</strong></div>
  </div>
  <div className="slip-foot">
   <p>Plan {trip.planStatus?(statusNames[trip.planStatus]??trip.planStatus).toLowerCase():'not started'} · Voucher {trip.voucherStatus?(statusNames[trip.voucherStatus]??trip.voucherStatus).toLowerCase():'not started'}{trip.foreignExpenseCount?` · ${trip.foreignExpenseCount} in another currency, not counted`:''}</p>
   <nav aria-label={`${trip.destination} actions`}><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Plan <ArrowUpRight size={12}/></Link><Link href={`/dashboard/travel/vouchers?tripId=${trip.id}`}>Expenses <ArrowUpRight size={12}/></Link>{trip.phase!=='upcoming'&&!paying&&(trip.payment?<><button type="button" onClick={startPaying}>Edit payment</button><button type="button" onClick={()=>onPayment(null)}>Remove</button></>:<button type="button" onClick={startPaying}>Record payment</button>)}</nav>
  </div>
  {trip.categories.length>0&&<details className="slip-items"><summary>Itemized</summary><table><thead><tr><th scope="col">Item</th><th scope="col">Planned</th><th scope="col">Claimed</th></tr></thead><tbody>{trip.categories.map(c=><tr key={c.category}><th scope="row">{categoryNames[c.category]??c.category}</th><td>{c.plannedMinor?usd(c.plannedMinor):'—'}</td><td>{c.claimedMinor?usd(c.claimedMinor):'—'}</td></tr>)}</tbody></table></details>}
  {paying&&<form className="slip-pay" onSubmit={save}><label>Amount paid<Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/></label><label>Date paid<Input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}/></label><div><Button type="button" variant="outline" onClick={()=>setPaying(false)}>Cancel</Button><Button type="submit">Stamp as paid</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}</form>}
 </li>;
}
