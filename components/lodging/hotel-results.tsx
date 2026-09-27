'use client';
import {useState} from 'react';
import {ArrowUpRight,Copy} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {canonicalLocation,hotelMapUrl,type HotelCatalog} from '@/packages/domain/hotel-discovery';
import type {NearbySearch} from '@/packages/domain/hotel-nearby';

export function HotelResults({catalog,result,onMore,onSelectLocation}:{catalog:HotelCatalog;result:NearbySearch;onMore:()=>void;onSelectLocation:(value:string)=>void}){
 const [copied,setCopied]=useState('');
 if(result.status==='empty')return null;
 if(result.status==='not_found')return <div className="hotel-empty"><h2>No listed properties found.</h2><p>Try a nearby city or a five-digit ZIP code. DTS may have additional lodging options.</p>{result.suggestions.length>0&&<div className="hotel-choices"><p>Did you mean:</p>{result.suggestions.map(choice=><button type="button" key={choice.key} onClick={()=>onSelectLocation(choice.label)}>{choice.label} <span>{choice.count}</span></button>)}</div>}</div>;
 if(result.status==='multiple_locations')return <div className="hotel-empty"><h2>Which location?</h2><p>Choose a city and state to search nearby hotels.</p><div className="hotel-choices">{result.suggestions.map(choice=><button type="button" key={choice.key} onClick={()=>onSelectLocation(choice.label)}>{choice.label} {choice.count>0&&<span>{choice.count}</span>}</button>)}</div></div>;
 return <section className="hotel-results" aria-label="Nearby FedRooms properties">
  <div className="hotel-results-heading"><div><h2>{result.radiusApplied?`FedRooms near ${result.location}`:`FedRooms in ${result.location}`}</h2><p>{result.total} {result.total===1?'property':'properties'} · GSA list dated {new Date(`${catalog.published}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}</p></div></div>
  <p className="hotel-results-note">These are property listings, not live room offers. {result.radiusApplied?'Distances estimate ZIP-center to ZIP-center, not street or driving distance.':'The public list does not include room rates or availability.'}</p>
  {result.total===0?<div className="hotel-empty"><p>No names match within this area. Try a wider distance or clear the hotel-name filter.</p></div>:<div className="hotel-list">{result.hotels.map(({property,distanceMiles})=>{
   const [name,address,,,postal,country]=property;
   const key=[name,address,postal,country].join('|');
   const copy=async()=>{try{await navigator.clipboard.writeText(`${name}\n${address}\n${canonicalLocation(property)} ${postal}`);setCopied(key)}catch{setCopied('error')}};
   return <article className="hotel-card" key={key}><div className="hotel-card-main"><div><h3>{name}</h3><p>{address}<br/>{canonicalLocation(property)} {postal}</p></div>{distanceMiles!==null&&<span className="hotel-zip-match">~{distanceMiles<1?distanceMiles.toFixed(1):Math.round(distanceMiles)} mi</span>}</div><div className="hotel-card-actions"><button type="button" onClick={copy}><Copy size={14}/>{copied===key?'Copied':copied==='error'?'Copy unavailable':'Copy details'}</button><a href={hotelMapUrl(property)} target="_blank" rel="noopener noreferrer">View on map <ArrowUpRight size={15}/></a></div></article>;
  })}</div>}
  {result.total>result.hotels.length&&<Button variant="outline" onClick={onMore} className="hotel-more">Show more hotels ({result.total-result.hotels.length} remaining)</Button>}
 </section>;
}
