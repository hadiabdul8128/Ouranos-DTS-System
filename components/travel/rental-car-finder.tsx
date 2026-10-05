'use client';
import {useEffect,useRef,useState} from 'react';
import {ExternalLink,Plane} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {milesFromKm,parseRentalCatalog,rentalMapUrl,searchRentalCounters,type RentalCatalog,type RentalLocation} from '@/packages/domain/rental-car';
import './rental-car-finder.css';

const SHOW_FIRST=8,SHOW_MAX=25;
let cached:Promise<RentalCatalog>|null=null;
function loadCatalog(){
 if(!cached)cached=fetch('/travel/rental-cars-2026.json').then(async response=>{
  if(!response.ok)throw new Error('The rental car list could not be loaded.');
  return parseRentalCatalog(await response.json());
 }).catch(error=>{cached=null;throw error});
 return cached;
}

function Results({destination,onSelect}:{destination:string;onSelect?:(location:RentalLocation)=>void}){
 const [catalog,setCatalog]=useState<RentalCatalog|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[all,setAll]=useState(false),[airportOnly,setAirportOnly]=useState(false);
 useEffect(()=>{let active=true;loadCatalog().then(value=>{if(active)setCatalog(value)},()=>{if(active)setError('The rental car list could not be loaded.')});return()=>{active=false}},[attempt]);
 if(error)return <div className="rental-finder-status" role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={()=>{setError('');setAttempt(n=>n+1)}}>Try again</Button></div>;
 if(!catalog)return <p className="rental-finder-status" role="status">Loading rental car counters…</p>;
 const result=searchRentalCounters(catalog,destination);
 if(result.status==='no-place')return <p className="rental-finder-status">Couldn’t place {destination} on the map. Rental counters are listed for U.S. cities written as City, ST. Ask your travel office for options.</p>;
 if(result.status==='none-near')return <p className="rental-finder-status">No Enterprise, Hertz, Avis, National or Alamo counter is within 50 miles of {result.place}. Ask your travel office for options.</p>;
 const airports=result.locations.filter(l=>l.airport),list=airportOnly&&airports.length?airports:result.locations,shown=list.slice(0,all?SHOW_MAX:SHOW_FIRST);
 return <>
  {airports.length>0&&<div className="rental-finder-filter" role="group" aria-label="Which counters"><button type="button" aria-pressed={!airportOnly} onClick={()=>setAirportOnly(false)}>All nearby</button><button type="button" aria-pressed={airportOnly} onClick={()=>setAirportOnly(true)}><Plane size={14} aria-hidden="true"/> At the airport</button></div>}
  <ul className="rental-finder-list">{shown.map(location=><li key={location.id}>
   <div className="rental-finder-info">
    <strong>{location.company}{location.branch&&<span className="rental-finder-branch">{' · '}{location.branch}</span>}</strong>
    <span>{milesFromKm(location.distanceKm).toFixed(1)} mi from {result.place}{location.airport&&<> · <Plane size={13} aria-hidden="true"/> Airport</>}</span>
    {location.address&&<span>{location.address}</span>}
   </div>
   <div className="rental-finder-actions">
    {onSelect&&<Button type="button" variant="outline" onClick={()=>onSelect(location)}>Use this</Button>}
    {location.phone&&<a href={`tel:${location.phone.replace(/[^\d+]/g,'')}`} aria-label={`Call ${location.company}, ${location.phone.replace(/^\+1 /,'')}`}>Call</a>}
    <a href={rentalMapUrl(location)} target="_blank" rel="noopener noreferrer" aria-label={`${location.company} on the map (opens in a new tab)`}>Map <ExternalLink size={13} aria-hidden="true"/></a>
   </div>
  </li>)}</ul>
  {!all&&list.length>SHOW_FIRST&&<button type="button" className="rental-finder-more" onClick={()=>setAll(true)}>Show {Math.min(list.length,SHOW_MAX)-SHOW_FIRST} more</button>}
 </>;
}

/** Rental car counters near the trip destination, inside the rental car cost. Locations only, no prices. */
export function RentalCarFinder({destination,label,onSelect}:{destination:string;label:string;onSelect?:(location:RentalLocation)=>void}){
 const [open,setOpen]=useState(false),panel=useRef<HTMLDetailsElement>(null);
 return <details ref={panel} className="cw-disclosure rental-finder" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{label}</summary>
  {open&&<div className="rental-finder-body">
   <p className="rental-finder-note">Book the least expensive compact car under the U.S. Government Rental Car Agreement, through your travel office. Prices aren’t shown here, so enter the rate you’re quoted.</p>
   <Results destination={destination} onSelect={onSelect?location=>{onSelect(location);if(panel.current)panel.current.open=false}:undefined}/>
   <p className="rental-finder-source">Counters from each company’s own location finder, collected by All the Places. Check hours before you go.</p>
  </div>}
 </details>;
}
