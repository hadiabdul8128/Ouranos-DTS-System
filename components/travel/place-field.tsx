'use client';
import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {OVERSEAS,STATES,parsePlace,formatPlace} from '@/packages/domain/place';
import './place-field.css';

type Props={id:string;label:string;value:string;onChange:(value:string)=>void;variant?:'travel'|'plan';hint?:string};
/** City plus state (or country), so searches get a real, unambiguous place. */
export function PlaceField({id,label,value,onChange,variant='travel',hint='The city nearest to where you’ll work.'}:Props){
 const [parts,setParts]=useState(()=>parsePlace(value));
 function update(patch:Partial<typeof parts>){const next={...parts,...patch};setParts(next);onChange(formatPlace(next.city,next.region,next.country))}
 const overseas=parts.region===OVERSEAS;
 return <div className={`place-field ${variant==='plan'?'cw-field cw-span-full':'travel-field'}`} role="group" aria-labelledby={`${id}-label`}>
  <label id={`${id}-label`} htmlFor={id}>{label}</label>
  <div className={`place-inputs ${overseas?'is-overseas':''}`}>
   <Input id={id} placeholder="City" value={parts.city} onChange={e=>update({city:e.target.value})} maxLength={80} autoComplete="off" required/>
   <div className="travel-select"><select aria-label={`${label} state`} value={parts.region} onChange={e=>update({region:e.target.value})} required><option value="" disabled>State</option>{STATES.map(([code,name])=><option key={code} value={code}>{name}</option>)}<option value={OVERSEAS}>Outside the U.S.</option></select><ChevronDown size={16} aria-hidden/></div>
   {overseas&&<Input aria-label={`${label} country`} placeholder="Country" value={parts.country} onChange={e=>update({country:e.target.value})} maxLength={60} required/>}
  </div>
  {hint&&<small className="place-hint">{hint}</small>}
 </div>;
}
