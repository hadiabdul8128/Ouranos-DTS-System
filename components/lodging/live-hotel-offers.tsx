'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import Image from 'next/image';
import {usePlatform} from '@/components/platform/provider';
import type {NearbySearch} from '@/packages/domain/hotel-nearby';
import type {HotelOfferResponse} from '@/platform/api/hotel-provider';
import type {HotelSearchForm} from './search-fields';

export function LiveHotelOffers({search,result}:{search:HotelSearchForm|null;result:NearbySearch|null}){
 const platform=usePlatform();
 const [state,setState]=useState<{key:string;response:HotelOfferResponse|null;error:string}>({key:'',response:null,error:''});
 const latitude=result?.center?.[0],longitude=result?.center?.[1];
 const checkin=search?.checkin,checkout=search?.checkout,radiusMiles=search?.radiusMiles;
 const key=`${latitude}:${longitude}:${radiusMiles}:${checkin}:${checkout}`;
 const token=platform.session?.access_token,api=process.env.NEXT_PUBLIC_OURANOS_API_URL;
 const response=token&&api?state.key===key?state.response:null:{status:'unavailable',source:null,offers:[]} as HotelOfferResponse;
 const error=state.key===key?state.error:'';
 const loading=Boolean(token&&api&&state.key!==key);
 useEffect(()=>{
  if(!checkin||!checkout||latitude===undefined||longitude===undefined){return}
  if(!token||!api)return;
  const controller=new AbortController();
  void fetch(`${api.replace(/\/$/,'')}/v1/hotels/search`,{
   method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:controller.signal,
   body:JSON.stringify({latitude,longitude,radiusMiles,checkin,checkout}),
  }).then(async response=>{if(!response.ok)throw new Error('Live hotel offers could not be loaded.');return response.json() as Promise<HotelOfferResponse>})
   .then(response=>{if(!controller.signal.aborted)setState({key,response,error:''})})
   .catch(error=>{if(!controller.signal.aborted)setState({key,response:null,error:error instanceof Error?error.message:'Live hotel offers could not be loaded.'})});
  return()=>controller.abort();
 },[token,api,latitude,longitude,radiusMiles,checkin,checkout,key]);
 if(!search||!result||result.status!=='found')return null;
 if(!checkin||!checkout)return <section className="hotel-live" aria-label="Live hotel offers"><h2>Prices, photos and ratings</h2><p>Add check-in and check-out dates to look for live room offers. You can browse nearby listed properties below without dates.</p></section>;
 const offers=(response?.offers||[]).filter(offer=>!search.hotelName||offer.name.toLowerCase().includes(search.hotelName.toLowerCase()));
 return <section className="hotel-live" aria-label="Live hotel offers"><div className="hotel-results-heading"><div><h2>Rooms near {result.location}</h2><p>{checkin} to {checkout} · 1 traveler · public room offers</p></div></div>
  {loading?<p className="hotel-live-message" role="status">Checking live room offers…</p>:error?<p className="hotel-live-message" role="alert">{error} Nearby property listings are still below.</p>:response?.status==='unavailable'?<p className="hotel-live-message">Live prices, photos and ratings are not connected yet. Nearby property listings are below.</p>:response?.source==='booking.com sandbox'?<p className="hotel-live-message">Test inventory only. These prices and hotels are not real booking offers.</p>:null}
  {response?.status==='results'&&offers.length===0?<p className="hotel-live-message">No live offers were returned for these dates and this search area.</p>:null}
  {offers.length>0&&<><div className="hotel-live-grid">{offers.map(offer=><article className="hotel-live-card" key={offer.id}>
   {offer.photoUrl?<div className="hotel-live-photo"><Image src={offer.photoUrl} alt={`${offer.name} property`} fill sizes="(max-width: 760px) 100vw, 50vw" unoptimized/></div>:<div className="hotel-live-no-photo">Photo unavailable</div>}
   <div className="hotel-live-details"><h3>{offer.name}</h3>{offer.address&&<p className="hotel-live-address">{offer.address}</p>}
    <div className="hotel-live-facts">{offer.reviewScore!==null&&<span>{offer.reviewScore.toFixed(1)}/10 guest rating{offer.reviewCount!==null?` · ${offer.reviewCount} reviews`:''}</span>}{offer.stars!==null&&<span>{offer.stars} stars</span>}</div>
    <div className="hotel-live-bottom"><div><strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:offer.currency}).format(offer.totalPrice)}</strong><small>Total for stay · public rate, subject to change</small></div><a href={offer.url} target="_blank" rel="noopener noreferrer">View offer <ArrowUpRight size={14}/></a></div>
   </div></article>)}</div><p className="hotel-results-note">Public offers from Booking.com. They are not verified FedRooms or DoD Preferred rates. Confirm the required lodging order and final price before booking.</p></>}
 </section>;
}
