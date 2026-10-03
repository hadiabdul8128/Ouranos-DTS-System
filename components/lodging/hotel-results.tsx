'use client';
import {useState} from 'react';
import {ArrowUpRight,Copy} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {canonicalLocation,hotelMapUrl,searchHotels,type HotelCatalog,type HotelProperty} from '@/packages/domain/hotel-discovery';

export function HotelResults({catalog,destination,workZip,hotelName,limit,onMore,onSelectLocation,onSelectHotel}:{catalog:HotelCatalog;destination:string;workZip:string;hotelName:string;limit:number;onMore:()=>void;onSelectLocation:(value:string)=>void;onSelectHotel?:(property:HotelProperty)=>void}){
 const [copied,setCopied]=useState('');
 const result=searchHotels(catalog,destination,{workZip,hotelName,limit});
 if(result.status==='empty')return <div className="hotel-empty">Enter the city or ZIP where you will stay.</div>;
 if(result.status==='not_found')return <div className="hotel-empty"><h2>No listed properties found for that location.</h2><p>Try the nearby city or a ZIP code.</p>{result.suggestions.length>0&&<div className="hotel-choices"><p>Did you mean:</p>{result.suggestions.map(choice=><button type="button" key={choice.key} onClick={()=>onSelectLocation(choice.label)}>{choice.label} <span>{choice.count}</span></button>)}</div>}</div>;
 if(result.status==='multiple_locations')return <div className="hotel-empty"><h2>Which location?</h2><p>Choose the city and state before viewing hotels.</p><div className="hotel-choices">{result.suggestions.map(choice=><button type="button" key={choice.key} onClick={()=>onSelectLocation(choice.label)}>{choice.label} <span>{choice.count}</span></button>)}</div></div>;
 return <section className="hotel-results" aria-label="Listed hotels">
  <div className="hotel-results-heading"><div><h2>Hotels in {result.location}</h2><p>{result.total} FedRooms {result.total===1?'property':'properties'} in this search · GSA list dated {new Date(`${catalog.published}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}</p></div></div>
  {result.total===0?<div className="hotel-empty"><p>No hotel names match this filter. Clear “Hotel name” to see the properties in {result.location}.</p></div>:<div className="hotel-list">{result.properties.map(property=>{
   const [name,address,,,postal,country]=property;
   const key=[name,address,postal,country].join('|');
   const exactZip=workZip.length===5&&postal.slice(0,5)===workZip;
   const copy=async()=>{try{await navigator.clipboard.writeText(`${name}\n${address}\n${canonicalLocation(property)} ${postal}`);setCopied(key)}catch{setCopied('error')}};
   return <article className="hotel-card" key={key}><div className="hotel-card-main"><div><h3>{name}</h3><p>{address}<br/>{canonicalLocation(property)} {postal}</p></div>{exactZip&&<span className="hotel-zip-match">Work ZIP match</span>}</div><div className="hotel-card-actions">{onSelectHotel&&<button type="button" onClick={()=>onSelectHotel(property)}>Use this hotel</button>}<button type="button" onClick={copy}><Copy size={14}/>{copied===key?'Copied':copied==='error'?'Copy unavailable':'Copy details'}</button><a href={hotelMapUrl(property)} target="_blank" rel="noopener noreferrer">View on map <ArrowUpRight size={15}/></a></div></article>
  })}</div>}
  {result.total>result.properties.length&&<Button variant="outline" onClick={onMore} className="hotel-more">Show more hotels ({result.total-result.properties.length} remaining)</Button>}
 </section>;
}
