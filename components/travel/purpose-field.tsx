'use client';
import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {Input} from '@/components/ui/input';

export const TRIP_PURPOSES=['Mission (TDY)','Training','Conference','Site visit','Meeting'];
const OTHER='other';

/** Common trip purposes, with Other for a typed one. */
export function PurposeField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [choice,setChoice]=useState(()=>!value||TRIP_PURPOSES.includes(value)?value:OTHER),[other,setOther]=useState(()=>TRIP_PURPOSES.includes(value)?'':value);
 return <>
  <div className="travel-field"><label htmlFor="purpose">Purpose</label><div className="travel-select"><select id="purpose" value={choice} onChange={e=>{setChoice(e.target.value);onChange(e.target.value===OTHER?other:e.target.value)}} required><option value="" disabled>Choose a purpose</option>{TRIP_PURPOSES.map(option=><option key={option} value={option}>{option}</option>)}<option value={OTHER}>Other</option></select><ChevronDown size={16} aria-hidden/></div></div>
  {choice===OTHER&&<div className="travel-field"><label htmlFor="other-purpose">Describe the purpose</label><Input id="other-purpose" value={other} onChange={e=>{setOther(e.target.value);onChange(e.target.value)}} maxLength={250} autoFocus={!value} required/></div>}
 </>;
}
