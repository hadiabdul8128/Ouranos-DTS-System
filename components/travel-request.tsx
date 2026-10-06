'use client';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {PlaceField} from '@/components/travel/place-field';
import {PurposeField} from '@/components/travel/purpose-field';
import {InstallationField,OrdersNumberField,ORDERS_DATES_HINT} from '@/components/travel/installation-field';
import {localToday} from '@/packages/domain/flight-search';
export default function TravelRequest(){
 const [today]=useState(localToday);
 const router=useRouter();const p=usePlatform();const [destination,setDestination]=useState(''),[installation,setInstallation]=useState(''),[ordersNumber,setOrdersNumber]=useState(''),[departure,setDeparture]=useState(''),[returnDate,setReturnDate]=useState(''),[purpose,setPurpose]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');if(!departure||!returnDate){setError(departure?'Pick your return date.':'Pick your travel dates.');return}if(departure<today){setError('Departure can’t be in the past.');return}if(returnDate<departure){setError('Return must follow departure.');return}if(!p.repository){setError('Choose a workspace in Settings.');return}setBusy(true);try{const id=crypto.randomUUID();await p.repository.stage('trip.save',id,{destination:destination.trim(),...(installation.trim()?{installation:installation.trim()}:{}),...(ordersNumber.trim()?{ordersNumber:ordersNumber.trim()}:{}),departure,returnDate,purpose:purpose.trim(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await p.engine?.sync();router.push(`/dashboard/travel/planning?tripId=${id}`)}catch(e){setError(e instanceof Error?e.message:'Unable to save.');setBusy(false)}}
 return <main className="quiet-page travel-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><Link href="/dashboard/platform">Settings</Link></header><section className="travel-stage"><Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link><h1>Where to?</h1><form className="travel-form" onSubmit={save}><PlaceField id="destination" label="Destination" value={destination} onChange={setDestination}/><InstallationField id="installation" value={installation} onChange={setInstallation}/><div className="travel-date-fields"><div className="travel-field"><label htmlFor="departure">Departure</label><Input type="date" id="departure" min={today} value={departure} onChange={e=>setDeparture(e.target.value)} required/></div><div className="travel-field"><label htmlFor="return">Return</label><Input type="date" id="return" min={departure||today} value={returnDate} onChange={e=>setReturnDate(e.target.value)} required/></div></div><small className="place-hint dates-hint">{ORDERS_DATES_HINT}</small><OrdersNumberField id="orders-number" value={ordersNumber} onChange={setOrdersNumber}/><PurposeField value={purpose} onChange={setPurpose}/>{error&&<p role="alert" className="form-error">{error}</p>}<Button type="submit" disabled={busy} className="continue-button">{busy?'Saving…':'Continue'}<ArrowRight size={16}/></Button></form></section><footer className="quiet-footer"><span/><SyncIndicator/></footer></main>;
}
