'use client';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {PlaceField} from '@/components/travel/place-field';
import {PurposeField} from '@/components/travel/purpose-field';
import {InstallationField,OrdersNumberField,ORDERS_DATES_HINT} from '@/components/travel/installation-field';
import {localToday} from '@/packages/domain/flight-search';
import {TripDatesField} from '@/components/travel/trip-dates-field';
import '@/app/dashboard/travel/new/trip-form.css';
export default function TravelRequest(){
 const [today]=useState(localToday);
 const router=useRouter();const p=usePlatform();const [destination,setDestination]=useState(''),[installation,setInstallation]=useState(''),[ordersNumber,setOrdersNumber]=useState(''),[departure,setDeparture]=useState(''),[returnDate,setReturnDate]=useState(''),[purpose,setPurpose]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');if(!departure||!returnDate){setError(departure?'Pick your return date.':'Pick your travel dates.');return}if(departure<today){setError('Departure can’t be in the past.');return}if(returnDate<departure){setError('Return must follow departure.');return}if(!p.repository){setError('Choose a workspace in Settings.');return}setBusy(true);try{const id=crypto.randomUUID();await p.repository.stage('trip.save',id,{destination:destination.trim(),...(installation.trim()?{installation:installation.trim()}:{}),...(ordersNumber.trim()?{ordersNumber:ordersNumber.trim()}:{}),departure,returnDate,purpose:purpose.trim(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await p.engine?.sync();router.push(`/dashboard/travel/planning?tripId=${id}`)}catch(e){setError(e instanceof Error?e.message:'Unable to save.');setBusy(false)}}
 return <main className="quiet-page travel-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><Link href="/dashboard/platform">Settings</Link></header><section className="travel-stage trip-form-stage"><Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link><h1>Where to?</h1><p className="travel-subtitle">Takes about a minute. You’ll add costs on the next page.</p><form className="travel-form trip-form" onSubmit={save}>
 {/* Sections with side labels: layout adapted from Ephraim Duncan's "Form sections with side labels" (blocks.so, via 21st.dev). */}
 <section className="trip-form-section" aria-labelledby="trip-where"><div className="trip-form-label"><h2 id="trip-where">Where</h2><p>Where the work is, as written on your orders.</p></div><div className="trip-form-fields"><PlaceField id="destination" label="Destination" value={destination} onChange={setDestination}/><InstallationField id="installation" value={installation} onChange={setInstallation}/></div></section>
 <section className="trip-form-section" aria-labelledby="trip-when"><div className="trip-form-label"><h2 id="trip-when">When</h2><p>{ORDERS_DATES_HINT}</p></div><div className="trip-form-fields"><TripDatesField departure={departure} returnDate={returnDate} today={today} onChange={(from,to)=>{setDeparture(from);setReturnDate(to);setError('')}}/></div></section>
 <section className="trip-form-section" aria-labelledby="trip-orders"><div className="trip-form-label"><h2 id="trip-orders">Orders</h2><p>Your approver sees these with the plan.</p></div><div className="trip-form-fields"><OrdersNumberField id="orders-number" value={ordersNumber} onChange={setOrdersNumber}/><PurposeField value={purpose} onChange={setPurpose}/></div></section>
 {error&&<p role="alert" className="form-error">{error}</p>}
 <div className="trip-form-actions"><Button type="submit" disabled={busy} className="continue-button">{busy?'Saving…':'Continue'}<ArrowRight size={16}/></Button></div>
</form></section><footer className="quiet-footer"><span/><SyncIndicator/></footer></main>;
}
