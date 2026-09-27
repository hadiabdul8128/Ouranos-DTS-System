'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import type {LocalRecord} from '@/packages/offline/database';
import {hotelTripContext} from '@/packages/domain/hotel-trip';
import {HotelSearchFields} from './search-fields';
import {HotelResults} from './hotel-results';
import {HotelBookingGuidance} from './booking-guidance';
import {useHotelCatalog} from './use-hotel-catalog';

const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const money=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);

export function HotelFinder(){
 const p=usePlatform();const [tripId,setTripId]=useState<string|null>(null),[hydrated,setHydrated]=useState(!p.configured);
 const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.toArray()||Promise.resolve([]),[p.repository]);
 const {catalog,error:catalogError,loading:catalogLoading,retry}=useHotelCatalog();
 const trip=tripId&&rows?hotelTripContext(rows,tripId):null;
 const [destination,setDestination]=useState(''),[workZip,setWorkZip]=useState(''),[hotelName,setHotelName]=useState(''),[limit,setLimit]=useState(12);
 useEffect(()=>{setTripId(new URLSearchParams(window.location.search).get('tripId')||'')},[]);
 useEffect(()=>{let active=true;if(p.engine)void p.engine.sync().finally(()=>{if(active)setHydrated(true)});return()=>{active=false}},[p.engine]);
 useEffect(()=>{if(trip){setDestination(trip.destination);setWorkZip('');setHotelName('');setLimit(12)}},[trip?.id,trip?.destination]);
 function changeDestination(value:string){setDestination(value);setLimit(12)}
 function changeWorkZip(value:string){setWorkZip(value);setLimit(12)}
 function changeHotelName(value:string){setHotelName(value);setLimit(12)}
 return <main className="quiet-page cw-page hotel-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link className="cw-workspace-link" href="/dashboard/platform">Settings</Link></header><section className="cw-shell hotel-shell"><Link href={tripId?`/dashboard/travel/planning?tripId=${tripId}`:'/dashboard/travel'} className="back-link"><ArrowLeft size={14}/>{tripId?'Travel plan':'Travel'}</Link>
  {tripId===null||!rows||!hydrated?<p className="cw-muted" role="status">Opening your trips…</p>:!tripId?<><h1>Find a place to stay.</h1><p className="cw-muted">Choose a trip and we’ll start with its destination and dates.</p><div className="cw-trip-list">{rows.filter(row=>row.kind==='trip').sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt)).map(row=><Link key={row.id} href={`/dashboard/travel/hotels?tripId=${row.id}`}><div><strong>{String(row.local.data.destination)}</strong><span>{date(String(row.local.data.departure))} — {date(String(row.local.data.returnDate))}</span></div><ArrowRight size={18}/></Link>)}</div>{!rows.some(row=>row.kind==='trip')&&<p className="hotel-empty">Save a trip first, then come back to see hotels for its destination. <Link href="/dashboard/travel/new">Create a trip →</Link></p>}</>:!trip?<><h1>Trip not found.</h1><p className="cw-muted">This trip is not available in the current workspace.</p><Link href="/dashboard/travel/hotels">Choose another trip →</Link></>:<>
   <p className="cw-eyebrow">Travel · hotel finder</p><h1>Find a place to stay.</h1><p className="hotel-lead">Start with real FedRooms properties near your destination. Confirm the lodging order, room availability, and final rate in DTS.</p>
   <div className="hotel-trip"><div><span>Saved trip</span><strong>{trip.destination}</strong><small>{date(trip.departure)} – {date(trip.returnDate)}</small></div>{trip.lodgingBudgetMinor!==null&&<div><span>{trip.budgetLabel}</span><strong>{money(trip.lodgingBudgetMinor)}</strong><small>Total in your travel plan · not a hotel quote</small></div>}</div>
   <HotelSearchFields destination={destination} onDestination={changeDestination} workZip={workZip} onWorkZip={changeWorkZip} hotelName={hotelName} onHotelName={changeHotelName}/>
   <HotelBookingGuidance/>
   {catalogLoading?<p className="hotel-empty" role="status">Loading real hotel properties…</p>:catalogError?<div className="hotel-empty" role="alert"><p>{catalogError}</p><button type="button" onClick={retry}>Try loading again</button></div>:catalog&&<HotelResults catalog={catalog} destination={destination} workZip={workZip} hotelName={hotelName} limit={limit} onMore={()=>setLimit(value=>value+12)} onSelectLocation={changeDestination}/>}
   <p className="hotel-source-note">Property information: <a href={catalog?.source||'https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms'} target="_blank" rel="noopener noreferrer">GSA FedRooms accepted properties ↗</a>. Listings may change. Ouranos does not check booking inventory or reserve rooms.</p>
  </>}
 </section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
