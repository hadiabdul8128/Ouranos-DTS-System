'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowUpRight,ChevronDown} from 'lucide-react';
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
 const months=shown.reduce<Array<{label:string;trips:TripHistoryEntry[]}>>((groups,trip)=>{const label=new Date(`${trip.departure}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});const last=groups[groups.length-1];if(last?.label===label)last.trips.push(trip);else groups.push({label,trips:[trip]});return groups},[]);
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <section className="cw-shell log-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <div className="log-head"><h1>Trip history.</h1>
    <div className="log-filters"><nav className="log-tabs" aria-label="Trips to show">{(['past','upcoming','all'] as View[]).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setView(v)}>{v==='past'?'Past':v==='upcoming'?'Upcoming':'All'}</button>)}</nav>
     <label className="log-year"><span className="sr-only">Year</span><select value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div></div>
   <p className="log-count">{totals.trips} trip{totals.trips===1?'':'s'}, {totals.nights} night{totals.nights===1?'':'s'} away</p>
   <dl className="log-figures">
    <div><dt>Planned</dt><dd>{usd(totals.plannedMinor)}</dd></div>
    <div><dt>Claimed</dt><dd>{usd(totals.claimedMinor)}</dd></div>
    <div><dt>Paid</dt><dd>{usd(totals.paidMinor)}</dd></div>
    <div><dt>Still owed</dt><dd>{usd(totals.awaitingMinor)}</dd></div>
   </dl>
   {rows===undefined?<p className="cw-muted" role="status">Loading your trips…</p>:!shown.length?<p className="log-empty">{view==='past'?'No past trips yet. A trip moves here after its return date.':'Nothing here yet.'}</p>:
   months.map(month=><section key={month.label} className="log-month" aria-label={month.label}><h2>{month.label}</h2><ol>{month.trips.map(trip=><TripCard key={trip.id} trip={trip} today={today} onPayment={payment=>setPayment(trip.id,payment)}/>)}</ol></section>)}
   <p className="history-note">Amounts in USD. Ouranos isn’t connected to DTS or finance, so “paid” is what you record here, on this device.</p>
  </section>
  <footer className="cw-footer"><span/><SyncIndicator/></footer>
 </main>;
}

function TripCard({trip,today,onPayment}:{trip:TripHistoryEntry;today:string;onPayment:(payment:{amountMinor:number;date:string}|null)=>void}){
 const [open,setOpen]=useState(false),[paying,setPaying]=useState(false),[amount,setAmount]=useState(''),[date,setDate]=useState(''),[error,setError]=useState('');
 const status=trip.payStatus==='paid'?`Paid ${day(trip.payment!.date,false)}`:payLabels[trip.payStatus].text;
 function startPaying(){setAmount(((trip.payment?.amountMinor??trip.claimedMinor??trip.plannedMinor??0)/100).toFixed(2));setDate(trip.payment?.date??today);setError('');setPaying(true)}
 function save(e:React.FormEvent){e.preventDefault();try{const amountMinor=parseAmountMinor(amount);if(!date)throw new Error('Choose the date you were paid.');onPayment({amountMinor,date});setPaying(false)}catch(err){setError(err instanceof Error?err.message:'Check the amount.')}}
 const [start,end]=[new Date(`${trip.departure}T12:00:00Z`),new Date(`${trip.returnDate}T12:00:00Z`)];
 const span=start.getUTCMonth()===end.getUTCMonth()?`${start.getUTCDate()}–${end.getUTCDate()}`:`${start.getUTCDate()} ${start.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}–${end.getUTCDate()} ${end.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}`;
 return <li className={`log-trip ${open?'is-open':''}`}>
  <button type="button" className="log-row" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span className="log-dates">{span}</span>
   <span className="log-place"><strong>{trip.destination}</strong><small>{[trip.purpose,`${trip.nights} night${trip.nights===1?'':'s'}`].filter(Boolean).join(' · ')}</small></span>
   <span className="log-money"><small>Planned</small>{usd(trip.plannedMinor)}</span>
   <span className="log-money"><small>Claimed</small>{usd(trip.claimedMinor)}</span>
   <span className={`log-state is-${trip.payStatus}`}>{status}</span>
   <ChevronDown size={15} className="log-chevron" aria-hidden="true"/>
  </button>
  {open&&<div className="log-detail">
   <p>Plan {trip.planStatus?(statusNames[trip.planStatus]??trip.planStatus).toLowerCase():'not started'}. Voucher {trip.voucherStatus?(statusNames[trip.voucherStatus]??trip.voucherStatus).toLowerCase():'not started'}.{trip.payment?` You recorded ${usd(trip.payment.amountMinor)} paid on ${day(trip.payment.date)}.`:''}{trip.foreignExpenseCount?` ${trip.foreignExpenseCount} expense${trip.foreignExpenseCount===1?' is':'s are'} in another currency and not counted.`:''}</p>
   {trip.categories.length>0&&<table className="log-breakdown"><thead><tr><th scope="col">Category</th><th scope="col">Planned</th><th scope="col">Claimed</th></tr></thead><tbody>{trip.categories.map(c=><tr key={c.category}><th scope="row">{categoryNames[c.category]??c.category}</th><td>{c.plannedMinor?usd(c.plannedMinor):'—'}</td><td>{c.claimedMinor?usd(c.claimedMinor):'—'}</td></tr>)}</tbody></table>}
   {paying?<form className="log-pay-form" onSubmit={save}><label>Amount paid<Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/></label><label>Date paid<Input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}/></label><div><Button type="button" variant="outline" onClick={()=>setPaying(false)}>Cancel</Button><Button type="submit">Save</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}</form>:
   <div className="log-actions"><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Open plan <ArrowUpRight size={13}/></Link><Link href={`/dashboard/travel/vouchers?tripId=${trip.id}`}>Expenses <ArrowUpRight size={13}/></Link>{trip.phase!=='upcoming'&&(trip.payment?<><button type="button" onClick={startPaying}>Edit payment</button><button type="button" onClick={()=>onPayment(null)}>Remove payment</button></>:<button type="button" onClick={startPaying}>Record payment</button>)}</div>}
  </div>}
 </li>;
}
