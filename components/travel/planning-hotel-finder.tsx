'use client';
import {useRef,useState} from 'react';
import {HotelTripSearch} from '@/components/lodging/hotel-finder';
import {useHotelCatalog} from '@/components/lodging/use-hotel-catalog';
import type {HotelTripContext} from '@/packages/domain/hotel-trip';
import type {HotelProperty} from '@/packages/domain/hotel-discovery';
import '@/app/dashboard/travel/hotels/hotels.css';

function Search({trip,onSelectHotel}:{trip:HotelTripContext;onSelectHotel?:(property:HotelProperty)=>void}){
 const {catalog,error,loading,retry}=useHotelCatalog();
 return <HotelTripSearch trip={trip} catalog={catalog} catalogError={error} catalogLoading={loading} retry={retry} embedded onSelectHotel={onSelectHotel}/>;
}
export function PlanningHotelFinder({trip,onSelectHotel,label}:{trip:HotelTripContext;onSelectHotel?:(property:HotelProperty)=>void;label?:string}){
 const [activated,setActivated]=useState(false),panel=useRef<HTMLDetailsElement>(null);
 function select(property:HotelProperty){onSelectHotel?.(property);if(panel.current)panel.current.open=false}
 return <details ref={panel} className="cw-disclosure planning-hotel-finder hotel-page" onToggle={event=>{if(event.currentTarget.open)setActivated(true)}}>
  <summary>{label??'Find hotels'} {!label&&<span>Near your destination</span>}</summary>
  {activated&&<Search key={`${trip.id}:${trip.destination}`} trip={trip} onSelectHotel={onSelectHotel?select:undefined}/>}
 </details>;
}
