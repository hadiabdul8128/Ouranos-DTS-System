'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePlatform} from './provider';
import type {PersonalStateKey,PersonalStateResponse} from '@/packages/contracts/personal-state';

type Envelope<T>={value:T;dirty:boolean};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function read<T>(key:string,legacy:string[],fallback:T):Envelope<T>{
 try{
  const raw=localStorage.getItem(key);
  if(raw){const parsed=JSON.parse(raw);if(object(parsed)&&'value'in parsed)return parsed as Envelope<T>;if(object(parsed))return {value:parsed as T,dirty:true}}
  for(const old of legacy){const value=localStorage.getItem(old);if(value){const parsed=JSON.parse(value);if(object(parsed))return {value:parsed as T,dirty:true}}}
 }catch{/* The server copy still loads when browser storage is unavailable. */}
 return {value:fallback,dirty:false};
}
function write<T>(key:string,envelope:Envelope<T>){try{localStorage.setItem(key,JSON.stringify(envelope))}catch{/* The server remains authoritative. */}}

/** Private state backed by Supabase with a small browser cache for offline starts and migration. */
export function usePersonalState<T extends Record<string,unknown>>(name:PersonalStateKey,fallback:T,legacy:string[]=[]){
 const p=usePlatform(),fallbackRef=useRef(fallback),legacyRef=useRef(legacy);
 const cacheKey=`ouranos.state.v1.${p.session?.user.id??'local'}.${p.organizationId??'none'}.${name}`;
 const [state,setState]=useState<T>(()=>read(cacheKey,legacy,fallback).value),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const current=useRef(state),queue=useRef<Promise<unknown>>(Promise.resolve()),mutations=useRef(0);
 useEffect(()=>{fallbackRef.current=fallback;legacyRef.current=legacy},[fallback,legacy]);
 const save=useCallback((value:T)=>{
  if(!p.client||!p.organizationId)return Promise.reject(new Error('Connect to your workspace to save.'));
  const client=p.client,organizationId=p.organizationId;
  const operation=queue.current.catch(()=>undefined).then(()=>client.request<PersonalStateResponse>('/v1/personal-state',{method:'PUT',body:JSON.stringify({organizationId,key:name,value})}));
  queue.current=operation.then(()=>{write(cacheKey,{value,dirty:false});setError('')}).catch(cause=>{setError(cause instanceof Error?cause.message:'Unable to save.');throw cause});
  return queue.current;
 },[p.client,p.organizationId,name,cacheKey]);
 useEffect(()=>{
  let active=true;const started=mutations.current,local=read(cacheKey,legacyRef.current,fallbackRef.current);setState(local.value);current.current=local.value;setLoading(true);setError('');
  if(!p.client||!p.organizationId){setLoading(false);return()=>{active=false}}
  const client=p.client,organizationId=p.organizationId;
  void client.request<PersonalStateResponse>(`/v1/personal-state?organizationId=${encodeURIComponent(organizationId)}&key=${name}`).then(async remote=>{
   if(!active)return;
   if(local.dirty){await save(local.value);return}
   if(mutations.current!==started){await save(current.current);return}
   const value=(remote.exists&&object(remote.value)?remote.value:fallbackRef.current) as T;
   setState(value);current.current=value;write(cacheKey,{value,dirty:false});
  }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Unable to load saved workspace data.')}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[p.client,p.organizationId,name,cacheKey,save]);
 const update=useCallback((change:(value:T)=>T)=>{
  const value=change(current.current);mutations.current++;current.current=value;setState(value);write(cacheKey,{value,dirty:true});void save(value).catch(()=>undefined);return value;
 },[cacheKey,save]);
 return {state,update,loading,error};
}
