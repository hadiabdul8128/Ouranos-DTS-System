'use client';
import {Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {hasFlight,hasLodging,hasLodgingTax,hasNonconventionalLodging,hasRental,hasTmcFee,LODGING_TAX,perDiemSituations,TMC_FEE,type PreAudit} from '@/packages/domain/pre-audit';
import './dts-checks-card.css';
import {Explain} from './explain';

type Line={category:string;description:string;merchant?:string};
type Props={items:Line[];purpose:string;atInstallation:boolean;answers:PreAudit;onAnswers:(answers:PreAudit)=>void;onAddLine:(category:'airfare'|'lodging',description:string)=>void;taxSeparate:boolean;locked:boolean};

function Choice<T extends string>({name,value,options,onChange,disabled}:{name:string;value:T|undefined;options:Array<[T,string]>;onChange:(value:T)=>void;disabled:boolean}){
 return <div className="dts-check-choice" role="radiogroup" aria-label={name}>{options.map(([option,label])=><button key={option} type="button" role="radio" aria-checked={value===option} disabled={disabled} onClick={()=>onChange(option)}>{label}</button>)}</div>;
}

/** The things DTS flags on Other Auths and Pre-Audits, or wants as separate lines, asked about while planning. */
export function DtsChecksCard({items,purpose,atInstallation,answers,onAnswers,onAddLine,taxSeparate,locked}:Props){
 const flight=hasFlight(items),rental=hasRental(items),needsFee=flight&&!hasTmcFee(items),needsTax=taxSeparate&&hasLodging(items)&&!hasLodgingTax(items);
 const lodging=hasLodging(items),rentalHome=hasNonconventionalLodging(items),situations=perDiemSituations(purpose);
 const set=(patch:PreAudit)=>onAnswers({...answers,...patch});
 return <section className="cw-card dts-checks" aria-labelledby="dts-checks-title">
  <h2 id="dts-checks-title">Before you submit in DTS</h2>
  <p className="cw-muted">DTS stops you with a pre-audit flag for some choices until you give a reason. Answer these now and paste the reasons into Other Auths and Pre-Audits.</p>
  {flight&&<div className="dts-check">
   <h3><Explain>{`Is your flight a GSA contract (City Pair) fare?`}</Explain></h3>
   <p><Explain>{`DTS marks these “GSA Contract Rate”. Use one when it’s offered.`}</Explain></p>
   <Choice name="GSA contract fare" value={answers.flightFare} options={[['gsa','Yes'],['other','No, a different fare']]} onChange={flightFare=>set({flightFare})} disabled={locked}/>
   {answers.flightFare==='other'&&<label className="dts-check-reason">Why not the GSA fare?<Textarea value={answers.flightReason??''} onChange={e=>set({flightReason:e.target.value})} maxLength={2000} rows={3} disabled={locked} placeholder="e.g. The GSA flight arrives after the report time on the orders."/></label>}
  </div>}
  {needsFee&&<div className="dts-check">
   <h3><Explain>{`Claim the TMC booking fee on its own line`}</Explain></h3>
   <p><Explain>{`The travel office (TMC) fee is claimed separately from the airfare.`}</Explain></p>
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
  {rentalHome&&<div className="dts-check is-warning">
   <h3>Airbnb, VRBO and similar rentals usually aren’t paid</h3>
   <p>They’re normally not allowed for safety reasons. Unless your approver says yes in advance, you may be paid less or nothing. Talk to your approver before you book.</p>
  </div>}
  {lodging&&atInstallation&&<div className="dts-check">
   <h3>Staying off base?</h3>
   <p><Explain>{`You can, but without a non-availability letter you’re only paid up to the on-base (ILP) rate. Full per diem applies only when on-base lodging isn’t available.`}</Explain></p>
  </div>}
  <details className="dts-check dts-perdiem" open={situations.some(s=>s.highlight)}>
   <summary>When your per diem changes</summary>
   <p>DTS sets meals and lodging rates. Change them on the Per Diem page if any of these apply:</p>
   <ul>{situations.map(s=><li key={s.id} className={s.highlight?'is-highlight':''}><strong><Explain>{s.title}</Explain></strong><span><Explain>{s.detail}</Explain></span></li>)}</ul>
  </details>
 </section>;
}
