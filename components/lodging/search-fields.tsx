'use client';
import {Input} from '@/components/ui/input';

export function HotelSearchFields({destination,onDestination,workZip,onWorkZip,hotelName,onHotelName}:{destination:string;onDestination:(value:string)=>void;workZip:string;onWorkZip:(value:string)=>void;hotelName:string;onHotelName:(value:string)=>void}){
 return <section className="hotel-search" aria-label="Find hotels">
  <label className="hotel-field hotel-destination"><span>Where will you stay?</span><Input value={destination} onChange={event=>onDestination(event.target.value)} placeholder="City, state or ZIP" autoComplete="address-level2" maxLength={120}/><small>Prefilled from your trip. Search by the city where you will stay.</small></label>
  <label className="hotel-field"><span>Work ZIP · optional</span><Input value={workZip} onChange={event=>onWorkZip(event.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" placeholder="Sort the same ZIP first" maxLength={5}/></label>
  <label className="hotel-field"><span>Hotel name · optional</span><Input value={hotelName} onChange={event=>onHotelName(event.target.value)} placeholder="Narrow this city" maxLength={100}/></label>
 </section>;
}
