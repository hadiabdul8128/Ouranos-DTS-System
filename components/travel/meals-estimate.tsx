'use client';
import {useState} from 'react';
import {computePerDiem} from '@/voucher/src/perDiem.js';
import type {PlanningModuleInput} from '@/packages/contracts/planning-module';
import {Explain} from './explain';
import {ChevronDown} from 'lucide-react';
import './meals-estimate.css';

type Allowance=NonNullable<PlanningModuleInput['allowance']>;
type Meal='breakfast'|'lunch'|'dinner';
const MEALS:Meal[]=['breakfast','lunch','dinner'];
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const weekday=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});

/** One line: about how much per diem pays for meals, with optional assumptions about meals expected before travel. */
export function MealsEstimate({trip,allowance,onChange,locked,hasMealExpense=false}:{trip:{destination:string;departure:string;returnDate:string};allowance:Allowance;onChange:(value:Allowance)=>void;locked:boolean;hasMealExpense?:boolean}){
 const [open,setOpen]=useState(false);
 if(!trip.destination||!trip.departure||!trip.returnDate)return null;
 const estimate=computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination,mealsProvided:allowance.mealsProvided,governmentMess:allowance.governmentMess});
 const provided=Object.values(allowance.mealsProvided).reduce((sum,day)=>sum+MEALS.filter(meal=>day[meal]).length,0);
 function toggle(date:string,meal:Meal){
  const day={...(allowance.mealsProvided[date]??{})};if(day[meal])delete day[meal];else day[meal]=true;
  const mealsProvided={...allowance.mealsProvided};if(Object.keys(day).length)mealsProvided[date]=day;else delete mealsProvided[date];
  onChange({...allowance,mealsProvided});
 }
 const included=allowance.enabled&&!hasMealExpense&&estimate.supported;
 return <section className="meals-estimate" aria-labelledby="meals-title">
  <div className="meals-estimate-head"><h3 id="meals-title">Meals & incidentals</h3><span className="meals-estimate-amount">{estimate.supported?usd(estimate.totals.mie):'Unavailable'}</span></div>
  <p className="meals-estimate-location">{estimate.days.length} days · {estimate.locality?.match==='city'?estimate.locality.name:trip.destination}</p>
  <label className="meals-estimate-check"><input type="checkbox" checked={included} disabled={locked||hasMealExpense||!estimate.supported} onChange={e=>onChange({...allowance,enabled:e.target.checked})}/><span>Include in budget</span></label>
  {hasMealExpense&&<p className="meals-estimate-note">Remove the separate meals expense to use this estimate.</p>}
  {!estimate.supported&&<p className="meals-estimate-note">Ask your travel office to confirm the rate.</p>}
  {estimate.warnings.map((warning:string)=><p className="meals-estimate-warning" key={warning}><Explain>{warning}</Explain></p>)}
  <button type="button" className="meals-estimate-toggle" aria-expanded={open} aria-controls="meals-assumptions" onClick={()=>setOpen(value=>!value)}><span>Meal assumptions{provided?` · ${provided} provided`:''}{allowance.governmentMess?' · DFAC':''}</span><ChevronDown size={16} aria-hidden="true"/></button>
  {open&&<div className="meals-estimate-assumptions" id="meals-assumptions">
   <p className="meals-estimate-note">First and last days use 75% of the daily rate. Confirm actual meals in your voucher after travel.</p>
   <label className="meals-estimate-check"><input type="checkbox" checked={allowance.governmentMess} disabled={locked} onChange={e=>onChange({...allowance,governmentMess:e.target.checked})}/><span><Explain>{'Base dining facility (DFAC)'}</Explain></span></label>
   <p className="meals-estimate-note">Mark meals you expect to receive free. Leave uncertain meals blank.</p>
   <div className="meals-estimate-days">{estimate.days.map((day:{date:string;mie:number})=><div key={day.date} className="meals-estimate-day"><span>{weekday(day.date)}</span><div>{MEALS.map(meal=><button key={meal} type="button" aria-label={`${meal} provided on ${weekday(day.date)}`} aria-pressed={Boolean(allowance.mealsProvided[day.date]?.[meal])} disabled={locked} onClick={()=>toggle(day.date,meal)}>{meal[0]!.toUpperCase()+meal.slice(1)}</button>)}</div><small>{usd(day.mie)}</small></div>)}</div>
  </div>}
 </section>;
}
