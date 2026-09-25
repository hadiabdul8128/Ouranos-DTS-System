'use client';
import {computePerDiem} from '@/voucher/src/perDiem.js';
import type {PlanningModuleInput} from '@/packages/contracts/planning-module';
import type {Allowance} from '@/packages/domain/voucher-adapter';
type Settings=NonNullable<PlanningModuleInput['allowance']>;
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export function AllowanceDetails({value}:{value:Allowance|null}){
 if(!value)return null;
 return <details className="cw-disclosure"><summary>Rate estimate <span>{value.supported?`${money(value.totals.mie)} meals`:'Check rates'}</span></summary>
 <p className="cw-muted">Estimate · <a href="https://www.travel.dod.mil/Travel-Transportation-Rates/Per-Diem/" target="_blank" rel="noreferrer">Verify rates</a></p>
 {value.supported&&<div className="cw-totals"><div><span>Meals & incidentals</span><strong>{money(value.totals.mie)}</strong></div><div><span>Lodging limit</span><strong>{money(value.totals.lodgingCap)}</strong></div></div>}
 {value.warnings.map((warning:string)=><p className="cw-muted" key={warning}>{warning}</p>)}
 {value.supported&&<div className="cw-rate-days">{value.days.map(day=><div key={day.date}><span>{day.date}</span><span>{money(day.mie)} meals</span><span>{day.lodgingCap==null?'—':`${money(day.lodgingCap)} lodging`}</span><small>{day.source}</small></div>)}</div>}
 </details>;
}
export function AllowanceEditor({settings,onChange,trip,disabled,onUse}:{settings:Settings;onChange:(value:Settings)=>void;trip:{departure:string;returnDate:string;destination:string};disabled:boolean;onUse:(value:Allowance)=>void}){
 const value=computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination,...settings});
 return <details className="cw-disclosure"><summary>Rate estimate <span>{settings.enabled&&value.supported?money(value.totals.mie):'Optional'}</span></summary>
 <label className="cw-check"><input type="checkbox" checked={settings.enabled} disabled={disabled} onChange={e=>onChange({...settings,enabled:e.target.checked})}/><span>Use rate estimates</span></label>
 {settings.enabled&&<><AllowanceDetails value={value}/><label className="cw-check"><input type="checkbox" checked={settings.governmentMess} disabled={disabled} onChange={e=>onChange({...settings,governmentMess:e.target.checked})}/><span>Government mess available</span></label>
 <details className="cw-disclosure"><summary>Provided meals</summary><div className="cw-meal-days">{value.days.map(day=><fieldset key={day.date} disabled={disabled}><legend>{day.date}</legend>{(['breakfast','lunch','dinner'] as const).map(meal=><label className="cw-check" key={meal}><input type="checkbox" checked={!!settings.mealsProvided[day.date]?.[meal]} onChange={e=>onChange({...settings,mealsProvided:{...settings.mealsProvided,[day.date]:{...settings.mealsProvided[day.date],[meal]:e.target.checked}}})}/><span>{meal}</span></label>)}</fieldset>)}</div></details>
 {!disabled&&value.supported&&<button type="button" className="cw-text-button" onClick={()=>onUse(value)}>Add estimates to budget</button>}</>}
 </details>;
}
