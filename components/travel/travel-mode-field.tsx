'use client';
import {Car,Bus,Plane,Truck,KeyRound} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {CTW_ONE_WAY_MILES,mileageMinor,needsCostComparison,travelModeHints,travelModeNames,travelModes,type TravelMode} from '@/packages/domain/travel-mode';
import './travel-mode-field.css';

const icons:Record<TravelMode,typeof Plane>={air:Plane,pov:Car,rental:KeyRound,government:Truck,other:Bus};
const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);

type Props={mode:TravelMode|undefined;onMode:(mode:TravelMode)=>void;miles:string;rate:string;onMileage:(patch:{miles?:string;rate?:string})=>void;onAddMileage:(minor:number)=>void;onAddRental:()=>void;disabled?:boolean};

/** How the traveler gets there; flights are only one of the answers. */
export function TravelModeField({mode,onMode,miles,rate,onMileage,onAddMileage,onAddRental,disabled}:Props){
 const estimate=mileageMinor(Number(miles),Math.round(Number(rate)*100));
 return <section className="travel-mode" aria-labelledby="travel-mode-label">
  <p id="travel-mode-label" className="travel-mode-label">How are you getting there?</p>
  <div className="travel-mode-options" role="radiogroup" aria-labelledby="travel-mode-label">{travelModes.map(option=>{const Icon=icons[option];return <button key={option} type="button" role="radio" aria-checked={mode===option} disabled={disabled} onClick={()=>onMode(option)}><Icon size={17} aria-hidden="true"/>{travelModeNames[option]}</button>})}</div>
  {mode&&<p className="travel-mode-hint">{travelModeHints[mode]}</p>}
  {mode==='pov'&&<div className="travel-mode-mileage">
   <label>Round-trip miles<Input inputMode="decimal" value={miles} onChange={e=>onMileage({miles:e.target.value})} placeholder="420" disabled={disabled}/></label>
   <label>Rate per mile<Input inputMode="decimal" value={rate} onChange={e=>onMileage({rate:e.target.value})} placeholder="0.70" disabled={disabled}/></label>
   <div className="travel-mode-estimate"><span>Estimate</span><strong>{estimate===null?'—':usd(estimate)}</strong></div>
   <Button type="button" variant="outline" disabled={disabled||estimate===null} onClick={()=>estimate!==null&&onAddMileage(estimate)}>Add mileage to costs</Button>
  </div>}
  {mode==='pov'&&needsCostComparison(Number(miles))&&<p className="travel-mode-ctw" role="status">That’s more than {CTW_ONE_WAY_MILES} miles each way, so flying is usually the official way to go. You can still drive, but attach a Constructed Travel Worksheet (CTW) in DTS, and you’re paid the lower of driving or the flight cost.</p>}
  {mode==='rental'&&<Button type="button" variant="outline" className="travel-mode-add" disabled={disabled} onClick={onAddRental}>Add rental car and fuel lines</Button>}
 </section>;
}
