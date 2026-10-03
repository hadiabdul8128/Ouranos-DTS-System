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

/** One line: about how much per diem pays for meals, with a way to mark meals that were provided. */
export function MealsEstimate({trip,allowance,onChange,locked}:{trip:{destination:string;departure:string;returnDate:string};allowance:Allowance;onChange:(value:Allowance)=>void;locked:boolean}){
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
   <div><h3 id="meals-title">Meals and incidentals</h3>
    {estimate.supported?<p><strong>About {usd(estimate.totals.mie)}</strong> for {estimate.days.length} days in {estimate.locality?.name??trip.destination}, paid by per diem.</p>
     :<p>Ouranos can’t estimate this trip. DTS works it out for you.</p>}
   </div>
  </div>
  <p className="meals-estimate-note"><Explain>{'Don’t add meals as an expense. First and last days are paid at 75%. This is the M&IE estimate; DTS has the final amount.'}</Explain></p>
  {estimate.warnings.map((warning:string)=><p className="meals-estimate-warning" key={warning}><Explain>{warning}</Explain></p>)}
  {!locked&&<label className="meals-estimate-check"><input type="checkbox" checked={allowance.governmentMess} onChange={e=>onChange({...allowance,governmentMess:e.target.checked})}/><span><Explain>{'I’ll eat at a base dining facility (DFAC)'}</Explain></span></label>}
  <button type="button" className="meals-estimate-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{provided?`${provided} provided meal${provided===1?'':'s'} marked`:'Were any meals provided?'} · {open?'Hide':'Mark them'}</button>
  {open&&<div className="meals-estimate-days"><p>Tap meals you got for free, like a hotel breakfast or a conference lunch. They’re taken off the estimate.</p>
   {estimate.days.map((day:{date:string;mie:number})=><div key={day.date} className="meals-estimate-day"><span>{weekday(day.date)}</span><div>{MEALS.map(meal=><button key={meal} type="button" aria-pressed={Boolean(allowance.mealsProvided[day.date]?.[meal])} disabled={locked} onClick={()=>toggle(day.date,meal)}>{meal[0]!.toUpperCase()+meal.slice(1)}</button>)}</div><small>{usd(day.mie)}</small></div>)}
  </div>}
 </section>;
}
