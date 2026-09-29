'use client';
import {Search} from 'lucide-react';
import {Input} from '@/components/ui/input';

export type HotelSearchForm={location:string;workZip:string;radiusMiles:number;hotelName:string;checkin:string;checkout:string};

export function HotelSearchFields({value,onChange,onSearch}:{value:HotelSearchForm;onChange:(value:HotelSearchForm)=>void;onSearch:()=>void}){
 const change=<K extends keyof HotelSearchForm>(key:K,next:HotelSearchForm[K])=>onChange({...value,[key]:next});
 return <form className="hotel-search" aria-label="Find hotels" onSubmit={event=>{event.preventDefault();onSearch()}}>
  <label className="hotel-field hotel-destination"><span>Where do you need a hotel?</span><Input value={value.location} onChange={event=>change('location',event.target.value)} placeholder="City, state or ZIP" autoComplete="address-level2" maxLength={120} required/><small>Search on your own. No trip or authorization is needed.</small></label>
  <label className="hotel-field"><span>Near this ZIP · optional</span><Input value={value.workZip} onChange={event=>change('workZip',event.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" placeholder="Worksite ZIP" maxLength={5}/></label>
  <label className="hotel-field"><span>Distance</span><select value={value.radiusMiles} onChange={event=>change('radiusMiles',Number(event.target.value))}><option value={5}>Within 5 miles</option><option value={10}>Within 10 miles</option><option value={25}>Within 25 miles</option><option value={50}>Within 50 miles</option></select></label>
  <label className="hotel-field"><span>Check-in · optional</span><Input type="date" value={value.checkin} onInput={event=>change('checkin',event.currentTarget.value)} onChange={event=>change('checkin',event.target.value)}/></label>
  <label className="hotel-field"><span>Check-out · optional</span><Input type="date" value={value.checkout} min={value.checkin||undefined} onInput={event=>change('checkout',event.currentTarget.value)} onChange={event=>change('checkout',event.target.value)}/></label>
  <label className="hotel-field"><span>Hotel name · optional</span><Input value={value.hotelName} onChange={event=>change('hotelName',event.target.value)} placeholder="Filter by name" maxLength={100}/></label>
  <div className="hotel-search-action"><button type="submit"><Search size={16}/> Find hotels</button><small>Dates are needed for live prices.</small></div>
 </form>;
}
