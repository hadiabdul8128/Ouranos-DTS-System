import type {PlanningModuleInput} from '../contracts/planning-module';
import {dtsOptions} from './expense-descriptions';

/** What to type into DTS, screen by screen in DTS's order (HQ RIO DTS Quick Guide), with values ready to copy. */
export type SheetField={label:string;value:string;copy?:boolean};
export type SheetSection={id:string;title:string;where:string;fields:SheetField[];notes:string[]};
type Trip={destination:string;installation?:string;departure:string;returnDate:string;purpose:string;ordersNumber?:string};
type Expense={category:string;description:string;merchant:string;incurredOn:string;amountMinor:number;paymentMethod?:string};

const amount=(minor:number)=>(minor/100).toFixed(2);
const day=(value:string)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric',timeZone:'UTC'}):'';
const FALLBACK:Record<string,string>={rental_car:'Rental Car - at TDY Area',fuel:'Rental Car - Fuel/Charging',parking:'Parking - TDY Area',ground_transport:'TNC Fares (Rideshare) - TDY Area',transport:'TNC Fares (Rideshare) - TDY Area'};
const TMC=/\bTMC\b/i,TAX=/\btax(es)?\b/i;

/** The DTS expense type for a line: its description when that is a DTS name, else the usual one for the category. */
export function dtsExpenseType(category:string,description:string){
 if(dtsOptions(category).includes(description))return description;
 if(TMC.test(description))return 'TMC Fee (IBA)';
 if(category==='lodging'&&TAX.test(description))return 'Lodging Tax';
 return FALLBACK[category]??null;
}

export function authorizationSheet(trip:Trip,plan:PlanningModuleInput):SheetSection[]{
 const items=plan.approvedExpenseItems,flight=items.some(i=>i.category==='airfare'&&!TMC.test(i.description)),rental=items.some(i=>i.category==='rental_car');
 const room=items.some(i=>i.category==='lodging'&&!TAX.test(i.description));
 const expenses=items.filter(i=>!(i.category==='airfare'&&!TMC.test(i.description)&&i.description!=='Airline Ticket (Self-Procure)')&&!(i.category==='lodging'&&!TAX.test(i.description))&&i.category!=='meals');
 const reasons=[
  ...(plan.preAudit?.flightFare==='other'&&plan.preAudit.flightReason?[{label:'Why not the GSA fare',value:plan.preAudit.flightReason,copy:true}]:[]),
  ...(plan.preAudit?.rentalClass==='larger'&&plan.preAudit.rentalReason?[{label:'Why a larger rental car',value:plan.preAudit.rentalReason,copy:true}]:[]),
  ...(plan.aeaJustification?[{label:'Hotel over the lodging rate (ACTUALS EXPENSE box)',value:plan.aeaJustification,copy:true}]:[]),
 ];
 return [
  {id:'start',title:'Start a new authorization',where:'DTS home',fields:[],notes:['Click Create New Document, then Routine TDY Trip.']},
  {id:'trip',title:'Trip details',where:'Trip Overview',fields:[
   {label:'Departure',value:day(trip.departure),copy:true},{label:'Return',value:day(trip.returnDate),copy:true},
   {label:'TDY location',value:trip.installation||trip.destination,copy:true},
   ...(trip.installation?[{label:'Nearest city',value:trip.destination,copy:true}]:[]),
   {label:'Purpose',value:trip.purpose,copy:true},
  ],notes:['The dates and location must match your orders (block 12 for the location).']},
  {id:'reservations',title:'Book your travel',where:'Reservations',fields:[],notes:[
   ...(flight?['Flight: pick a GSA Contract Rate flight when DTS offers one.']:[]),
   ...(rental?['Rental car: pick the least expensive compact car under the U.S. Government Rental Car Agreement.']:[]),
   ...(room?['Lodging: DTS lists on-base and preferred lodging first. Book there if it’s available.']:[]),
   ...(!flight&&!rental&&!room?['Nothing to book for this trip.']:[]),
  ]},
  {id:'perdiem',title:'Meals and lodging rates',where:'Per Diem Entitlements',fields:[],notes:[
   'DTS fills in the rates. Only change them if your meals or lodging are provided, or you take leave.',
   ...(plan.aeaJustification?['Your hotel is over the rate: edit the location and check “Actual Lodging Cost (over per diem)”.']:[]),
  ]},
  {id:'expenses',title:'Add your expenses',where:'Expenses',fields:[
   ...expenses.map(i=>({label:dtsExpenseType(i.category,i.description)??i.description,value:amount(i.authorizedAmountMinor),copy:true})),
  ],notes:['Attach your orders: Add, then expense type Travel Orders.',...(expenses.length?[]:['No other expenses to add.'])]},
  {id:'accounting',title:'Pick the line of accounting',where:'Accounting',fields:[],notes:['Click Add LOA and pick the one your unit uses. Ask your ODTA if you don’t see it.']},
  ...(reasons.length?[{id:'preaudit',title:'Answer the pre-audit flags',where:'Other Auths and Pre-Audits',fields:reasons,notes:['Pick the reason code DTS offers, then paste each reason.']}]:[]),
  {id:'submit',title:'Sign and submit',where:'Review and Sign',fields:[...(trip.ordersNumber?[{label:'Comment for your approver',value:`Orders ${trip.ordersNumber}`,copy:true}]:[])],notes:['Check “I agree to SIGN this document”, choose your unit’s routing list, then Submit Completed Document.']},
 ];
}

export function voucherSheet(trip:Trip,expenses:Expense[]):SheetSection[]{
 const listed=expenses.filter(e=>!(e.category==='airfare'&&!TMC.test(e.description))&&e.category!=='meals'&&!(e.category==='lodging'&&!TAX.test(e.description)));
 const room=expenses.filter(e=>e.category==='lodging'&&!TAX.test(e.description));
 return [
  {id:'v-start',title:'Start the voucher',where:'Vouchers',fields:[],notes:['Find this trip and click Create Voucher.']},
  {id:'v-trip',title:'Check your trip dates',where:'Trip Overview',fields:[{label:'Departure',value:day(trip.departure),copy:true},{label:'Return',value:day(trip.returnDate),copy:true}],notes:['If your trip changed, fix it on Edit Itinerary.']},
  {id:'v-expenses',title:'Enter what you spent',where:'Expenses',fields:listed.map(e=>({label:`${dtsExpenseType(e.category,e.description)??(e.description||e.merchant)} · ${day(e.incurredOn)}${e.paymentMethod?` · ${e.paymentMethod==='gtcc'?'GTCC':'Personal'}`:''}`,value:amount(e.amountMinor),copy:true})),notes:[
   'Edit each planned expense to the actual amount and add any new ones, like the TMC fee.',
   ...(expenses.some(e=>e.category==='airfare'&&!TMC.test(e.description))?['A flight booked in DTS is already on the voucher. Don’t enter it again.']:[]),
  ]},
  ...(room.length?[{id:'v-lodging',title:'Match lodging to your receipt',where:'Per Diem Entitlements',fields:room.map(e=>({label:`${e.merchant||'Lodging'} · total on receipt`,value:amount(e.amountMinor),copy:true})),notes:['Set the lodging amount to what your hotel receipt shows, without the taxes.']}]:[]),
  {id:'v-attach',title:'Attach your documents',where:'Expenses',fields:[],notes:['Attach everything on your “What to attach in DTS” checklist on the Expenses page.']},
  {id:'v-submit',title:'Sign and submit',where:'Review and Sign',fields:[],notes:['Check “I agree to SIGN this document”, choose your routing list, then Submit Completed Document. Watch your email in case it’s returned.']},
 ];
}
