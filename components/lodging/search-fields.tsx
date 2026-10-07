'use client';
import {Input} from '@/components/ui/input';

export function HotelSearchFields({destination,onDestination,workZip,onWorkZip,hotelName,onHotelName,compact=false}:{compact?:boolean;destination:string;onDestination:(value:string)=>void;workZip:string;onWorkZip:(value:string)=>void;hotelName:string;onHotelName:(value:string)=>void}){
 const filters=<><label className="hotel-field"><span>Work ZIP · optional</span><Input value={workZip} onChange={event=>onWorkZip(event.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" placeholder={compact?'e.g. 28202':'Sort the same ZIP first'} maxLength={5}/>{compact&&<small>Matching ZIPs appear first.</small>}</label>
  <label className="hotel-field"><span>Hotel name · optional</span><Input value={hotelName} onChange={event=>onHotelName(event.target.value)} placeholder={compact?'Name or brand':'Narrow this city'} maxLength={100}/></label></>;
 return <section className={`hotel-search ${compact?'hotel-search-compact':''}`} aria-label="Find hotels">
  <label className="hotel-field hotel-destination"><span>{compact?'City or ZIP':'Where will you stay?'}</span><Input value={destination} onChange={event=>onDestination(event.target.value)} placeholder="City, state or ZIP" autoComplete="address-level2" maxLength={120}/>{!compact&&<small>Prefilled from your trip. Search by the city where you will stay.</small>}</label>
  {compact?<details className="hotel-filters"><summary>Filter hotels{(workZip||hotelName)&&<span>Filters applied</span>}</summary><div className="hotel-filter-fields">{filters}</div></details>:filters}
 </section>;
}
