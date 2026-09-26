'use client';
import {useState} from 'react';

const months=Array.from({length:12},(_,index)=>({value:String(index+1).padStart(2,'0'),label:new Date(Date.UTC(2026,index,1)).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})}));
const years=Array.from({length:100},(_,index)=>String(2000+index));

export function FinancialMonthField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
 const [year,setYear]=useState(()=>value.slice(0,4)||String(new Date().getUTCFullYear()));
 const month=value.slice(5);
 return <fieldset className="finance-field finance-month"><legend>{label}</legend><div>
  <select aria-label={`${label} — month`} value={month} onChange={event=>onChange(event.target.value?`${year}-${event.target.value}`:'')}><option value="">No date set</option>{months.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
  <select aria-label={`${label} — year`} value={year} onChange={event=>{setYear(event.target.value);if(month)onChange(`${event.target.value}-${month}`)}}>{years.map(item=><option key={item} value={item}>{item}</option>)}</select>
 </div></fieldset>;
}
