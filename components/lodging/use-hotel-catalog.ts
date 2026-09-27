'use client';
import {useCallback,useEffect,useState} from 'react';
import {parseHotelCatalog,type HotelCatalog} from '@/packages/domain/hotel-discovery';

let cached:Promise<HotelCatalog>|null=null;
function load(){
 if(!cached)cached=fetch('/lodging/fedrooms-2026.json').then(async response=>{
  if(!response.ok)throw new Error('The hotel list could not be loaded.');
  return parseHotelCatalog(await response.json());
 }).catch(error=>{cached=null;throw error});
 return cached;
}

export function useHotelCatalog(){
 const [catalog,setCatalog]=useState<HotelCatalog|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 const retry=useCallback(()=>{setError('');setLoading(true);setAttempt(value=>value+1)},[]);
 useEffect(()=>{let active=true;void load().then(value=>{if(active){setCatalog(value);setLoading(false)}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'The hotel list could not be loaded.');setLoading(false)}});return()=>{active=false}},[attempt]);
 return {catalog,error,loading,retry};
}
