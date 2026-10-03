'use client';
import {useState} from 'react';
import {computePerDiem} from '@/voucher/src/perDiem.js';
import type {PlanningModuleInput} from '@/packages/contracts/planning-module';
import {Explain} from './explain';
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
 return <section className="meals-estimate" aria-labelledby="meals-title">
  <div className="meals-estimate-head">
   <div><h3 id="meals-title">Meals and incidentals estimate</h3>
    {estimate.supported?<p><strong>About {usd(estimate.totals.mie)}</strong> for {estimate.days.length} days in {estimate.locality?.name??trip.destination}, estimated before travel.</p>
     :<p>Ouranos can’t estimate this trip yet. Your travel office can tell you the rate.</p>}
   </div>
  </div>
  <p className="meals-estimate-note"><Explain>{'Optional estimate for your authorization. First and last days use 75% of the daily rate. Confirm what actually happened after travel when preparing your voucher.'}</Explain></p>
  {estimate.warnings.map((warning:string)=><p className="meals-estimate-warning" key={warning}><Explain>{warning}</Explain></p>)}
  <label className="meals-estimate-check"><input type="checkbox" checked={allowance.enabled&&!hasMealExpense&&estimate.supported} disabled={locked||hasMealExpense||!estimate.supported} onChange={e=>onChange({...allowance,enabled:e.target.checked})}/><span>Include this estimate in my authorization total</span></label>
  <p className="meals-estimate-note">{hasMealExpense?'Your plan already has a meals expense. Remove that line to use this estimate without counting meals twice.':allowance.enabled&&estimate.supported?'Included with your planned expenses when you submit.':'Not included in your authorization total.'}</p>
  {!locked&&<label className="meals-estimate-check"><input type="checkbox" checked={allowance.governmentMess} onChange={e=>onChange({...allowance,governmentMess:e.target.checked})}/><span><Explain>{'I expect to eat at a base dining facility (DFAC)'}</Explain></span></label>}
  <button type="button" className="meals-estimate-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{provided?`${provided} expected free meal${provided===1?'':'s'} marked`:'Do you expect any free meals?'} · {open?'Hide':'Optional'}</button>
  {open&&<div className="meals-estimate-days"><p>Only mark meals you already expect to receive for free, like a hotel breakfast or conference lunch. If you don’t know yet, leave them blank. These assumptions reduce the estimate.</p>
   {estimate.days.map((day:{date:string;mie:number})=><div key={day.date} className="meals-estimate-day"><span>{weekday(day.date)}</span><div>{MEALS.map(meal=><button key={meal} type="button" aria-pressed={Boolean(allowance.mealsProvided[day.date]?.[meal])} disabled={locked} onClick={()=>toggle(day.date,meal)}>{meal[0]!.toUpperCase()+meal.slice(1)}</button>)}</div><small>{usd(day.mie)}</small></div>)}
  </div>}
 </section>;
}
