'use client';
import {Input} from '@/components/ui/input';

/** The base or installation, kept next to the nearest city the way DTS asks for both. */
export function InstallationField({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}){
 return <div className="travel-field installation-field">
  <label htmlFor={id}>Installation or base · optional</label>
  <Input id={id} value={value} onChange={e=>onChange(e.target.value)} maxLength={120} placeholder="e.g. Joint Base Lewis-McChord" autoComplete="off"/>
  <small className="place-hint">Use the name in block 12 of your orders. DTS wants the installation, with the nearest city above.</small>
 </div>;
}

/** The orders number, so the trip can be matched to its orders and any modifications. */
export function OrdersNumberField({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}){
 return <div className="travel-field installation-field">
  <label htmlFor={id}>Orders number · optional</label>
  <Input id={id} value={value} onChange={e=>onChange(e.target.value)} maxLength={60} autoComplete="off"/>
 </div>;
}

/** Shown under the trip dates. */
export const ORDERS_DATES_HINT='Use the dates on your orders. If they change after approval, you’ll need an orders modification.';
