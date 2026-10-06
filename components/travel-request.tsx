'use client';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {PlaceField} from '@/components/travel/place-field';
import {PurposeField} from '@/components/travel/purpose-field';
import {InstallationField,OrdersNumberField} from '@/components/travel/installation-field';
import {localToday} from '@/packages/domain/flight-search';
import {TripDatesField} from '@/components/travel/trip-dates-field';
import '@/app/dashboard/travel/new/trip-form.css';
/** What the trip will be, as far as it's filled in, for the bar beside Create trip. */
function tripSummary(destination:string,departure:string,returnDate:string){
 const day=(v:string)=>new Date(`${v}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
 const nights=departure&&returnDate?Math.round((new Date(`${returnDate}T12:00:00`).getTime()-new Date(`${departure}T12:00:00`).getTime())/86_400_000):null;
 const parts=[destination.trim()&&!destination.trim().startsWith(',')?destination.trim():'',departure?(returnDate?`${day(departure)} – ${day(returnDate)}`:`From ${day(departure)}`):'',nights!==null&&nights>0?`${nights} ${nights===1?'night':'nights'}`:''].filter(Boolean);
 return parts.length?parts.join(' · '):'Add a destination and dates to create the trip.';
}

export default function TravelRequest(){
 const [today]=useState(localToday);
 const router=useRouter();const p=usePlatform();const [destination,setDestination]=useState(''),[installation,setInstallation]=useState(''),[ordersNumber,setOrdersNumber]=useState(''),[departure,setDeparture]=useState(''),[returnDate,setReturnDate]=useState(''),[purpose,setPurpose]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');if(!departure||!returnDate){setError(departure?'Pick your return date.':'Pick your travel dates.');return}if(departure<today){setError('Departure can’t be in the past.');return}if(returnDate<departure){setError('Return must follow departure.');return}if(!p.repository){setError('Choose a workspace in Settings.');return}setBusy(true);try{const id=crypto.randomUUID();await p.repository.stage('trip.save',id,{destination:destination.trim(),...(installation.trim()?{installation:installation.trim()}:{}),...(ordersNumber.trim()?{ordersNumber:ordersNumber.trim()}:{}),departure,returnDate,purpose:purpose.trim(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await p.engine?.sync();router.push(`/dashboard/travel/planning?tripId=${id}`)}catch(e){setError(e instanceof Error?e.message:'Unable to save.');setBusy(false)}}
 return <main className="quiet-page travel-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><Link href="/dashboard/platform">Settings</Link></header><section className="travel-stage trip-form-stage"><Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link><h1>Where to?</h1><form className="travel-form trip-form" onSubmit={save}>
 {/* Label beside its field, one row per question: after Cnippet's "Horizontal Form Fields" (via 21st.dev). */}
 <div className="trip-form-rows">
  <PlaceField id="destination" label="Destination" value={destination} onChange={setDestination}/>
  <InstallationField id="installation" value={installation} onChange={setInstallation}/>
  <TripDatesField departure={departure} returnDate={returnDate} today={today} hint="As on your orders. Changes after approval need an orders modification." onChange={(from,to)=>{setDeparture(from);setReturnDate(to);setError('')}}/>
  <OrdersNumberField id="orders-number" value={ordersNumber} onChange={setOrdersNumber}/>
  <PurposeField value={purpose} onChange={setPurpose}/>
 </div>
 {error&&<p role="alert" className="form-error">{error}</p>}
 <div className="trip-form-bar">
  <p className="trip-form-summary" aria-live="polite">{tripSummary(destination,departure,returnDate)}</p>
  <Button type="submit" disabled={busy} className="continue-button">{busy?'Creating…':'Create trip'}</Button>
 </div>
</form></section><footer className="quiet-footer"><span/><SyncIndicator/></footer></main>;
}
