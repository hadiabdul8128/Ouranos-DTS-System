import {computePerDiem,lodgingCapFor} from '../../voucher/src/perDiem.js';
import type {PlannedExpense} from '../contracts/planning-module';

/** The Approving Official may authorize Actual Expense Allowance up to 300% of the maximum lodging rate. */
export const AEA_MAX_PERCENT=300;
const TAX=/\btax(es)?\b/i;
const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);

export type LodgingOverage={
 nights:number;allowedNightlyMinor:number;actualNightlyMinor:number;allowedTotalMinor:number;actualTotalMinor:number;
 differenceMinor:number;percent:number;overMax:boolean;locality:string;destination:string;
 /** How the destination matched a GSA locality: its own city, a covering county, or the state standard rate. */
 match:'city'|'county'|'standard';
};
type Trip={destination:string;departure:string;returnDate:string};
type Lodging=Pick<PlannedExpense,'category'|'description'|'authorizedAmountMinor'|'startDate'|'endDate'>;

/** Planned lodging (room cost, not taxes) compared with the per diem lodging cap for the same nights; null when within the cap or rates are unknown. */
export function lodgingOverage(trip:Trip,items:Lodging[]):LodgingOverage|null{
 const rooms=items.filter(item=>item.category==='lodging'&&item.authorizedAmountMinor>0&&!TAX.test(item.description));
 if(!rooms.length||trip.departure>=trip.returnDate)return null;
 const perDiem=computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination});
 if(!perDiem.locality)return null;
 let nights=0,allowedTotalMinor=0,actualTotalMinor=0;
 for(const room of rooms){
  const cap=lodgingCapFor(perDiem,room.startDate??trip.departure,room.endDate??trip.returnDate);
  if(!cap.nights||cap.perNight.length!==cap.nights)return null;
  nights+=cap.nights;allowedTotalMinor+=Math.round(cap.cap*100);actualTotalMinor+=room.authorizedAmountMinor;
 }
 if(!nights||actualTotalMinor<=allowedTotalMinor)return null;
 const allowedNightlyMinor=Math.round(allowedTotalMinor/nights),actualNightlyMinor=Math.round(actualTotalMinor/nights);
 const percent=Math.round(actualNightlyMinor/allowedNightlyMinor*100);
 return {nights,allowedNightlyMinor,actualNightlyMinor,allowedTotalMinor,actualTotalMinor,differenceMinor:actualTotalMinor-allowedTotalMinor,percent,overMax:percent>AEA_MAX_PERCENT,locality:perDiem.locality.name,destination:trip.destination,match:perDiem.locality.match};
}

/** Whether the trip is in a GSA (CONUS) per diem locality, where hotel taxes are claimed as their own line. */
export function inGsaLocality(trip:Trip){
 if(!trip.destination||!trip.departure||trip.departure>trip.returnDate)return false;
 return Boolean(computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination}).locality);
}

/** A justification laid out with the items AFMAN 65-114 para 5.9 asks for; the traveler fills in the bracketed parts. */
export function aeaJustificationDraft(o:LodgingOverage){
 return [
  `Requesting Actual Expense Allowance (AEA) for lodging in ${o.destination}.`,
  `Allowed nightly lodging rate: ${usd(o.allowedNightlyMinor)}`,
  `Actual nightly lodging rate: ${usd(o.actualNightlyMinor)}`,
  `Difference for the trip: ${usd(o.differenceMinor)} (${usd(o.actualTotalMinor)} actual minus ${usd(o.allowedTotalMinor)} allowed, ${o.nights} night${o.nights===1?'':'s'})`,
  `AEA percentage: ${o.percent}% of the maximum lodging rate`,
  'Efforts to find lodging within per diem: [list the hotels you checked and their rates]',
  'Circumstances: [why no lodging was available at the per diem rate, e.g. a major conference or event]',
 ].join('\n');
}
