'use client';
import {useCallback,useSyncExternalStore} from 'react';
import {usePlatform} from '@/components/platform/provider';
import type {Checklist,PlannerItem} from '@/packages/domain/planner';

/** Appointments, deadlines and checklists, kept on this device per account and workspace. */
export type PlannerState={items:PlannerItem[];checklists:Checklist[]};
const EMPTY:PlannerState={items:[],checklists:[]};
const listeners=new Set<()=>void>();
const cache=new Map<string,{raw:string|null;value:PlannerState}>();

function read(key:string):PlannerState{
 let raw:string|null=null;try{raw=localStorage.getItem(key)}catch{}
 const hit=cache.get(key);if(hit&&hit.raw===raw)return hit.value;
 let value=EMPTY;try{const parsed=raw?JSON.parse(raw):null;if(parsed&&Array.isArray(parsed.items)&&Array.isArray(parsed.checklists))value=parsed}catch{}
 cache.set(key,{raw,value});return value;
}
function subscribe(listener:()=>void){
 listeners.add(listener);const onStorage=(e:StorageEvent)=>{if(e.key?.startsWith('ouranos.planner.'))listener()};
 window.addEventListener('storage',onStorage);
 return ()=>{listeners.delete(listener);window.removeEventListener('storage',onStorage)};
}

export function usePlanner(){
 const p=usePlatform();
 const key=`ouranos.planner.v1.${p.session?.user.id??'local'}.${p.organizationId??'none'}`;
 const state=useSyncExternalStore(subscribe,()=>read(key),()=>EMPTY);
 const update=useCallback((change:(current:PlannerState)=>PlannerState)=>{
  const next=change(read(key));
  try{localStorage.setItem(key,JSON.stringify(next))}catch{throw new Error('This browser could not save your planner.')}
  listeners.forEach(listener=>listener());
 },[key]);
 return {state,update};
}
