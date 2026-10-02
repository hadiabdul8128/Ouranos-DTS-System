import type {PlanningModuleInput} from '../contracts/planning-module';

/** Choices that make DTS stop the traveler on Other Auths and Pre-Audits until they give a reason. */
export type PreAudit=NonNullable<PlanningModuleInput['preAudit']>;
type Line={category:string;description:string};

export const TMC_FEE='TMC Fee (IBA)';
export const LODGING_TAX='Lodging Tax';
export const hasFlight=(items:Line[])=>items.some(item=>item.category==='airfare'&&!/\bTMC\b/i.test(item.description));
export const hasRental=(items:Line[])=>items.some(item=>item.category==='rental_car');
export const hasTmcFee=(items:Line[])=>items.some(item=>/\bTMC\b/i.test(item.description));
export const hasLodging=(items:Line[])=>items.some(item=>item.category==='lodging'&&!/\btax(es)?\b/i.test(item.description));
export const hasLodgingTax=(items:Line[])=>items.some(item=>item.category==='lodging'&&/\btax(es)?\b/i.test(item.description));

/** Only the answers that still apply to the planned costs, so removing the flight drops its reason too. */
export function relevantPreAudit(items:Line[],answers:PreAudit):PreAudit|undefined{
 const kept:PreAudit={};
 if(hasFlight(items)&&answers.flightFare){kept.flightFare=answers.flightFare;if(answers.flightFare==='other'&&answers.flightReason?.trim())kept.flightReason=answers.flightReason.trim()}
 if(hasRental(items)&&answers.rentalClass){kept.rentalClass=answers.rentalClass;if(answers.rentalClass==='larger'&&answers.rentalReason?.trim())kept.rentalReason=answers.rentalReason.trim()}
 return Object.keys(kept).length?kept:undefined;
}
/** What blocks submitting: a flagged choice without its reason. */
export function preAuditProblem(items:Line[],answers:PreAudit){
 if(hasFlight(items)&&answers.flightFare==='other'&&!answers.flightReason?.trim())return 'Your flight isn’t a GSA contract fare. Give the reason for your approver before submitting.';
 if(hasRental(items)&&answers.rentalClass==='larger'&&!answers.rentalReason?.trim())return 'Your rental car is bigger than compact. Give the reason for your approver before submitting.';
 return '';
}
/** The flagged choices and reasons an approver should see. */
export function preAuditFlags(answers:PreAudit|undefined){
 const flags:Array<{title:string;reason:string}>=[];
 if(answers?.flightFare==='other')flags.push({title:'Flight is not a GSA contract fare',reason:answers.flightReason??''});
 if(answers?.rentalClass==='larger')flags.push({title:'Rental car larger than compact',reason:answers.rentalReason??''});
 return flags;
}

/** Airbnb, VRBO and similar rentals are normally not allowed unless the approver says yes in advance. */
const NONCONVENTIONAL=/\b(air ?bnb|vrbo|vacasa|home ?away|vacation rental)\b/i;
export const isNonconventionalLodging=(text:string)=>NONCONVENTIONAL.test(text);
export const hasNonconventionalLodging=(items:Array<Line&{merchant?:string}>)=>items.some(item=>item.category==='lodging'&&isNonconventionalLodging(`${item.description} ${item.merchant??''}`));

/** When DTS per diem differs from the normal rate, and what to change in DTS (HQ RIO DTS Quick Guide, Step 7 and tip 3). */
export const ANNUAL_TOUR='Annual Tour (AT)';
export function perDiemSituations(purpose:string){
 const annualTour=/annual tour|\bAT\b/i.test(purpose);
 return [
  {id:'dfac',title:'Staying on base where there’s a dining facility',detail:annualTour?'On Annual Tour with base lodging and a DFAC, no per diem is paid. DTS should set this; check the Per Diem page.':'The Government meal rate applies instead of full meals and incidentals. Check the Per Diem page in DTS.',highlight:annualTour},
  {id:'leave',title:'Taking leave during the trip',detail:'Leave days get no per diem. Military members mark full days of annual leave on the Per Diem page (Duty Conditions).',highlight:false},
  {id:'field',title:'Field rations and free housing (for example, a tent)',detail:'Mark it in Duty Conditions on the Per Diem page so per diem is reduced.',highlight:false},
  {id:'commercial',title:'Authorized to stay off base at a military installation',detail:'Mark it in Duty Conditions so DTS uses the commercial lodging rate.',highlight:false},
 ];
}
