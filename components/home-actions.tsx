'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowRight,CircleHelp,Compass,Hotel,Plane,Receipt} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {progressFor,tripHref} from '@/components/travel/trip-timeline';
import {usePayments} from '@/components/travel/use-payments';
import {localToday} from '@/packages/domain/flight-search';
import type {LocalRecord} from '@/packages/offline/database';
import './home-actions.css';

const text=(value:unknown)=>typeof value==='string'?value:'';
const day=(value:string)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'';

/** Home: the one trip that needs you, then big plain buttons for everything else. */
export function HomeActions(){
 const p=usePlatform(),[today]=useState(localToday),{payments}=usePayments();
 const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.toArray()||Promise.resolve([]),[p.repository]);
 // Trips that need something: current and upcoming first by date, then past trips most recent first.
 const needs=(rows??[]).filter(r=>r.kind==='trip').map(r=>({trip:r.local,...progressFor(r.local,rows!,Boolean(payments[r.id]),today)})).filter(t=>t.next.action)
  .sort((a,b)=>{const aUpcoming=text(a.trip.data.returnDate)>=today,bUpcoming=text(b.trip.data.returnDate)>=today;return aUpcoming!==bUpcoming?(aUpcoming?-1:1):aUpcoming?text(a.trip.data.departure).localeCompare(text(b.trip.data.departure)):text(b.trip.data.returnDate).localeCompare(text(a.trip.data.returnDate))});
 const first=needs[0],expensesTrip=needs.find(t=>t.next.action?.to==='expenses');
 const actions=[
  {href:'/dashboard/travel/new',label:'Plan a trip',hint:'Start a new travel plan',icon:Plane},
  {href:expensesTrip?tripHref(expensesTrip.trip.id).expenses:'/dashboard/travel',label:'Add my expenses',hint:expensesTrip?`For ${text(expensesTrip.trip.data.destination)}`:'After a trip, file your voucher',icon:Receipt},
  {href:'/dashboard/travel/hotels',label:'Find a hotel',hint:'Hotels near where you’re going',icon:Hotel},
  {href:'/dashboard/help',label:'Help',hint:'Short guides with pictures',icon:CircleHelp},
 ];
 return <div className="home-actions">
  {first&&first.next.action&&<Link className="home-next" href={tripHref(first.trip.id)[first.next.action.to]}>
   <span className="home-next-label">Next for {text(first.trip.data.destination)} · {day(text(first.trip.data.departure))}–{day(text(first.trip.data.returnDate))}</span>
   <strong>{first.next.title}</strong><span className="home-next-go">{first.next.action.label} <ArrowRight size={16}/></span>
  </Link>}
  <nav className="home-grid" aria-label="What you can do">{actions.map(({href,label,hint,icon:Icon})=><Link key={label} href={href}><Icon size={22} aria-hidden="true"/><strong>{label}</strong><span>{hint}</span></Link>)}</nav>
  <div className="home-more"><Link href="/dashboard/travel">All my trips <ArrowRight size={14}/></Link><Link href="/dashboard/transition"><Compass size={14}/> Life after the military</Link></div>
 </div>;
}
