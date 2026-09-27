'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {SyncIndicator} from '@/components/platform/provider';
import {findNearbyHotels} from '@/packages/domain/hotel-nearby';
import {HotelSearchFields,type HotelSearchForm} from './search-fields';
import {HotelResults} from './hotel-results';
import {HotelBookingGuidance} from './booking-guidance';
import {useHotelCatalog} from './use-hotel-catalog';

const initial:HotelSearchForm={location:'',workZip:'',radiusMiles:10,hotelName:'',checkin:'',checkout:''};

export function HotelFinder(){
 const {catalog,centers,error:catalogError,loading:catalogLoading,retry}=useHotelCatalog();
 const [draft,setDraft]=useState<HotelSearchForm>(initial),[search,setSearch]=useState<HotelSearchForm|null>(null),[limit,setLimit]=useState(12),[error,setError]=useState('');
 const result=useMemo(()=>catalog&&centers&&search?findNearbyHotels(catalog,centers,search.location,{workZip:search.workZip,radiusMiles:search.radiusMiles,hotelName:search.hotelName,limit}):null,[catalog,centers,search,limit]);
 function submit(value=draft){
  if(!value.location.trim()){setError('Enter a city, state, or ZIP code.');return}
  if(value.workZip&&value.workZip.length!==5){setError('Enter a five-digit work ZIP or leave it blank.');return}
  if(Boolean(value.checkin)!==Boolean(value.checkout)){setError('Add both dates to check prices, or leave both blank.');return}
  if(value.checkin&&value.checkout<=value.checkin){setError('Check-out must be after check-in.');return}
  setError('');setLimit(12);setSearch({...value});
 }
 function selectLocation(location:string){const value={...draft,location};setDraft(value);submit(value)}
 return <main className="quiet-page cw-page hotel-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link className="cw-workspace-link" href="/dashboard/platform">Settings</Link></header><section className="cw-shell hotel-shell"><Link href="/dashboard/travel" className="back-link"><ArrowLeft size={14}/>Travel</Link>
  <p className="cw-eyebrow">Travel · hotel finder</p><h1>Find a place to stay.</h1><p className="hotel-lead">Enter where you are going. We’ll find listed hotels near that location, even if you haven’t planned a trip in Ouranos.</p>
  <HotelSearchFields value={draft} onChange={setDraft} onSearch={()=>submit()}/>
  {error&&<p className="hotel-form-error" role="alert">{error}</p>}
  {catalogLoading?<p className="hotel-empty" role="status">Loading hotel search data…</p>:catalogError?<div className="hotel-empty" role="alert"><p>{catalogError}</p><button type="button" onClick={retry}>Try loading again</button></div>:!search?<div className="hotel-start-note">Search by city and state or ZIP. You can narrow results to the area around a worksite ZIP.</div>:catalog&&result&&<HotelResults catalog={catalog} result={result} onMore={()=>setLimit(value=>value+12)} onSelectLocation={selectLocation}/>}
  <HotelBookingGuidance/>
  <p className="hotel-source-note">Properties: <a href={catalog?.source||'https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms'} target="_blank" rel="noopener noreferrer">GSA FedRooms accepted properties ↗</a>. Approximate ZIP locations: <a href={centers?.source||'https://www.geonames.org/'} target="_blank" rel="noopener noreferrer">GeoNames ↗</a> (CC BY 4.0). Listings may change; confirm lodging order, price and availability in DTS.</p>
 </section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}
