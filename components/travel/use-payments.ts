'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePlatform} from '@/components/platform/provider';
import {usePlanner} from '@/components/planner/store';
import type {TripPayment} from '@/packages/domain/trip-history';

/** Payments the traveler recorded, saved to their account so leaders and other devices see them.
 * Payments saved only in this browser by an earlier version are uploaded once, then cleared here. */
export function usePayments(){
 const p=usePlatform(),{state,update}=usePlanner();
 const [payments,setPayments]=useState<Record<string,TripPayment>>({}),[error,setError]=useState('');
 const migrated=useRef(false);
 const load=useCallback(async()=>{
  if(!p.client||!p.organizationId)return;
  try{setPayments((await p.client.request<{payments:Record<string,TripPayment>}>(`/v1/payments?organizationId=${p.organizationId}`)).payments)}catch{setError('Recorded payments couldn’t be loaded.')}
 },[p.client,p.organizationId]);
 useEffect(()=>{const timer=setTimeout(()=>void load());return()=>clearTimeout(timer)},[load]);
 useEffect(()=>{
  const local=Object.entries(state.payments);if(migrated.current||!local.length||!p.client||!p.organizationId)return;
  migrated.current=true;const client=p.client,organizationId=p.organizationId;
  void (async()=>{
   for(const [tripId,payment] of local){try{await client.request('/v1/payments',{method:'PUT',body:JSON.stringify({organizationId,tripId,...payment})})}catch{return}}
   update(s=>({...s,payments:{}}));await load();
  })();
 },[state.payments,p.client,p.organizationId,update,load]);
 const save=useCallback(async(tripId:string,payment:TripPayment|null)=>{
  if(!p.client||!p.organizationId)throw new Error('Connect to your workspace to record payments.');
  const previous=payments;setError('');
  setPayments(current=>{const next={...current};if(payment)next[tripId]=payment;else delete next[tripId];return next});
  try{await p.client.request('/v1/payments',{method:payment?'PUT':'DELETE',body:JSON.stringify({organizationId:p.organizationId,tripId,...(payment??{})})})}
  catch(e){setPayments(previous);setError(e instanceof Error?e.message:'The payment wasn’t saved. Try again.')}
 },[p.client,p.organizationId,payments]);
 return {payments,save,error};
}
