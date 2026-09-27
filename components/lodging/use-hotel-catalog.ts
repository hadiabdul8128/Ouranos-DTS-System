'use client';
import {useCallback,useEffect,useState} from 'react';
import {parseHotelCatalog,type HotelCatalog} from '@/packages/domain/hotel-discovery';
import {postalCentersSchema,type PostalCenters} from '@/packages/domain/hotel-nearby';

let cached:Promise<{catalog:HotelCatalog;centers:PostalCenters}>|null=null;
function load(){
 if(!cached)cached=Promise.all(['/lodging/fedrooms-2026.json','/lodging/us-postal-centroids.json'].map(async path=>{
  const response=await fetch(path);
  if(!response.ok)throw new Error('The hotel search data could not be loaded.');
  return response.json();
 })).then(([properties,postal])=>({catalog:parseHotelCatalog(properties),centers:postalCentersSchema.parse(postal)})).catch(error=>{cached=null;throw error});
 return cached;
}

export function useHotelCatalog(){
 const [data,setData]=useState<{catalog:HotelCatalog;centers:PostalCenters}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 const retry=useCallback(()=>{setError('');setLoading(true);setAttempt(value=>value+1)},[]);
 useEffect(()=>{let active=true;void load().then(value=>{if(active){setData(value);setLoading(false)}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'The hotel search data could not be loaded.');setLoading(false)}});return()=>{active=false}},[attempt]);
 return {catalog:data?.catalog||null,centers:data?.centers||null,error,loading,retry};
}
