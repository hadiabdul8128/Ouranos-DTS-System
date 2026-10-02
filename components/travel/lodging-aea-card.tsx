'use client';
import {useState} from 'react';
import {Copy} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {AEA_MAX_PERCENT,aeaJustificationDraft,type LodgingOverage} from '@/packages/domain/lodging-aea';
import './lodging-aea-card.css';

export const GSA_RATE_LOOKUP='https://www.gsa.gov/travel/plan-a-trip/per-diem-rates';
const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);

/** Shown when planned lodging is over the per diem cap: the numbers, and the AEA justification DTS asks for. */
export function LodgingAeaCard({overage,value,onChange,locked}:{overage:LodgingOverage;value:string;onChange:(value:string)=>void;locked:boolean}){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{setCopied(false)}}
 return <section className="cw-card lodging-aea" aria-labelledby="lodging-aea-title">
  <h2 id="lodging-aea-title">Your hotel is over the per diem lodging rate</h2>
  <p className="cw-muted">In DTS, ask for an Actual Expense Allowance (AEA): check “Actual Lodging Cost (over per diem)” on the Per Diem page, then paste this justification under Other Auths and Pre-Audits.</p>
  <dl className="lodging-aea-numbers">
   <div><dt>Allowed per night</dt><dd>{usd(overage.allowedNightlyMinor)}</dd></div>
   <div><dt>Your hotel per night</dt><dd>{usd(overage.actualNightlyMinor)}</dd></div>
   <div><dt>Over for the trip</dt><dd>{usd(overage.differenceMinor)}</dd></div>
   <div><dt>Of the max rate</dt><dd>{overage.percent}%</dd></div>
  </dl>
  {overage.overMax&&<p className="lodging-aea-limit" role="status">That’s more than {AEA_MAX_PERCENT}% of the lodging rate, the most an approver can allow. Look for a cheaper hotel or talk to your approver first.</p>}
  <label className="cw-field" htmlFor="lodging-aea-text">Justification for your approver</label>
  <Textarea id="lodging-aea-text" value={value} onChange={e=>onChange(e.target.value)} maxLength={4000} rows={9} disabled={locked} placeholder="Explain why you need this hotel."/>
  <div className="lodging-aea-actions">
   {!locked&&<Button type="button" variant="outline" onClick={()=>onChange(aeaJustificationDraft(overage))}>{value.trim()?'Start over from a draft':'Start from a draft'}</Button>}
   {value.trim()&&<Button type="button" variant="ghost" onClick={()=>void copy()}><Copy size={14}/> {copied?'Copied':'Copy for DTS'}</Button>}
  </div>
  <p className="cw-muted">Fill in the parts in [brackets].</p>
  <p className="lodging-aea-source">{overage.match==='standard'?<>Using the {overage.locality.replace('Standard Rate, ','')} standard rate ({usd(overage.allowedNightlyMinor)}/night) because your city isn’t a listed GSA locality. Bases can have their own rate, so check yours.</>:overage.match==='county'?<>Using the {overage.locality} rate, which covers your city’s county.</>:<>Using the GSA rate for {overage.locality}.</>} <a href={GSA_RATE_LOOKUP} target="_blank" rel="noopener noreferrer">Check the official rate</a>. DTS has the final numbers.</p>
 </section>;
}
