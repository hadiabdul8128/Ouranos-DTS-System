'use client';
import {Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {hasFlight,hasLodging,hasLodgingTax,hasRental,hasTmcFee,LODGING_TAX,TMC_FEE,type PreAudit} from '@/packages/domain/pre-audit';
import './dts-checks-card.css';

type Line={category:string;description:string};
type Props={items:Line[];answers:PreAudit;onAnswers:(answers:PreAudit)=>void;onAddLine:(category:'airfare'|'lodging',description:string)=>void;taxSeparate:boolean;locked:boolean};

function Choice<T extends string>({name,value,options,onChange,disabled}:{name:string;value:T|undefined;options:Array<[T,string]>;onChange:(value:T)=>void;disabled:boolean}){
 return <div className="dts-check-choice" role="radiogroup" aria-label={name}>{options.map(([option,label])=><button key={option} type="button" role="radio" aria-checked={value===option} disabled={disabled} onClick={()=>onChange(option)}>{label}</button>)}</div>;
}

/** The things DTS flags on Other Auths and Pre-Audits, or wants as separate lines, asked about while planning. */
export function DtsChecksCard({items,answers,onAnswers,onAddLine,taxSeparate,locked}:Props){
 const flight=hasFlight(items),rental=hasRental(items),needsFee=flight&&!hasTmcFee(items),needsTax=taxSeparate&&hasLodging(items)&&!hasLodgingTax(items);
 if(!flight&&!rental&&!needsTax)return null;
 const set=(patch:PreAudit)=>onAnswers({...answers,...patch});
 return <section className="cw-card dts-checks" aria-labelledby="dts-checks-title">
  <h2 id="dts-checks-title">Before you submit in DTS</h2>
  <p className="cw-muted">DTS stops you with a pre-audit flag for some choices until you give a reason. Answer these now and paste the reasons into Other Auths and Pre-Audits.</p>
  {flight&&<div className="dts-check">
   <h3>Is your flight a GSA contract (City Pair) fare?</h3>
   <p>DTS marks these “GSA Contract Rate”. Use one when it’s offered.</p>
   <Choice name="GSA contract fare" value={answers.flightFare} options={[['gsa','Yes'],['other','No, a different fare']]} onChange={flightFare=>set({flightFare})} disabled={locked}/>
   {answers.flightFare==='other'&&<label className="dts-check-reason">Why not the GSA fare?<Textarea value={answers.flightReason??''} onChange={e=>set({flightReason:e.target.value})} maxLength={2000} rows={3} disabled={locked} placeholder="e.g. The GSA flight arrives after the report time on the orders."/></label>}
  </div>}
  {needsFee&&<div className="dts-check">
   <h3>Claim the TMC booking fee on its own line</h3>
   <p>The travel office (TMC) fee is claimed separately from the airfare.</p>
   {!locked&&<Button type="button" variant="outline" onClick={()=>onAddLine('airfare',TMC_FEE)}><Plus size={14}/> Add a TMC fee line</Button>}
  </div>}
  {rental&&<div className="dts-check">
   <h3>What size is the rental car?</h3>
   <p>Pick the least expensive compact car and make sure it’s under the U.S. Government Rental Car Agreement.</p>
   <Choice name="Rental car size" value={answers.rentalClass} options={[['compact','Compact'],['larger','Larger than compact']]} onChange={rentalClass=>set({rentalClass})} disabled={locked}/>
   {answers.rentalClass==='larger'&&<label className="dts-check-reason">Why a larger car?<Textarea value={answers.rentalReason??''} onChange={e=>set({rentalReason:e.target.value})} maxLength={2000} rows={3} disabled={locked} placeholder="e.g. Four travelers sharing one car with equipment."/></label>}
  </div>}
  {needsTax&&<div className="dts-check">
   <h3>Put hotel taxes on their own line</h3>
   <p>In the U.S., claim the room rate and the hotel taxes separately. Taxes don’t count against the lodging rate.</p>
   {!locked&&<Button type="button" variant="outline" onClick={()=>onAddLine('lodging',LODGING_TAX)}><Plus size={14}/> Add a lodging tax line</Button>}
  </div>}
 </section>;
}
