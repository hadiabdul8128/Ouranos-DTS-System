import type {Entity} from '../contracts';

/** A payment the traveler recorded; recorded by the traveler. */
export type TripPayment={amountMinor:number;date:string};
export type TripPhase='past'|'current'|'upcoming';
export type TripHistoryEntry={
 id:string;destination:string;departure:string;returnDate:string;purpose:string;nights:number;phase:TripPhase;
 plannedMinor:number|null;claimedMinor:number|null;expenseCount:number;foreignExpenseCount:number;
 categories:Array<{category:string;plannedMinor:number;claimedMinor:number}>;
 planStatus:string|null;voucherStatus:string|null;payment:TripPayment|null;
 payStatus:'paid'|'awaiting'|'not_filed'|'not_due';
};

const text=(value:unknown)=>typeof value==='string'?value:'';
const latest=(rows:Entity[])=>[...rows].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
const daysBetween=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
const FILED=['in_review','approved','verified'];

/** One entry per trip, newest first, with planned and claimed amounts in USD cents. */
export function tripHistory(entities:Entity[],payments:Record<string,TripPayment>,today:string):TripHistoryEntry[]{
 return entities.filter(e=>e.kind==='trip'&&e.status!=='cancelled'&&text(e.data.departure)&&text(e.data.returnDate)).map(trip=>{
  const departure=text(trip.data.departure),returnDate=text(trip.data.returnDate);
  const plan=latest(entities.filter(e=>e.kind==='authorization'&&e.tripId===trip.id));
  const voucher=latest(entities.filter(e=>e.kind==='voucher'&&e.tripId===trip.id));
  const expenses=entities.filter(e=>e.kind==='expense'&&e.tripId===trip.id);
  const items=Array.isArray((plan?.data.formData as {approvedExpenseItems?:unknown}|undefined)?.approvedExpenseItems)?(plan!.data.formData as {approvedExpenseItems:Array<{category:string;authorizedAmountMinor:number}>}).approvedExpenseItems:[];
  const usd=expenses.filter(e=>e.data.currency==='USD'&&typeof e.data.amountMinor==='number');
  const byCategory=new Map<string,{plannedMinor:number;claimedMinor:number}>();
  for(const item of items){const c=byCategory.get(item.category)??{plannedMinor:0,claimedMinor:0};c.plannedMinor+=item.authorizedAmountMinor;byCategory.set(item.category,c)}
  for(const e of usd){const key=text(e.data.category)==='transport'?'ground_transport':text(e.data.category);const c=byCategory.get(key)??{plannedMinor:0,claimedMinor:0};c.claimedMinor+=e.data.amountMinor as number;byCategory.set(key,c)}
  const payment=payments[trip.id]??null,voucherStatus=voucher?.status??null;
  const phase:TripPhase=returnDate<today?'past':departure>today?'upcoming':'current';
  const payStatus:TripHistoryEntry['payStatus']=payment?'paid':voucherStatus&&FILED.includes(voucherStatus)?'awaiting':phase==='past'?'not_filed':'not_due';
  return {id:trip.id,destination:text(trip.data.destination),departure,returnDate,purpose:text(trip.data.purpose),nights:Math.max(0,daysBetween(departure,returnDate)),phase,
   plannedMinor:items.length?items.reduce((sum,item)=>sum+item.authorizedAmountMinor,0):null,
   claimedMinor:usd.length?usd.reduce((sum,e)=>sum+(e.data.amountMinor as number),0):null,
   expenseCount:expenses.length,foreignExpenseCount:expenses.length-usd.length,
   categories:[...byCategory].map(([category,v])=>({category,...v})).sort((a,b)=>b.plannedMinor+b.claimedMinor-a.plannedMinor-a.claimedMinor),
   planStatus:plan?.status??null,voucherStatus,payment,payStatus};
 }).sort((a,b)=>b.departure.localeCompare(a.departure));
}

/** Totals for a set of trips; awaiting is what was claimed on filed vouchers not yet marked paid. */
export function historyTotals(entries:TripHistoryEntry[]){
 return {
  trips:entries.length,
  nights:entries.reduce((s,e)=>s+e.nights,0),
  plannedMinor:entries.reduce((s,e)=>s+(e.plannedMinor??0),0),
  claimedMinor:entries.reduce((s,e)=>s+(e.claimedMinor??0),0),
  paidMinor:entries.reduce((s,e)=>s+(e.payment?.amountMinor??0),0),
  awaitingMinor:entries.filter(e=>e.payStatus==='awaiting').reduce((s,e)=>s+(e.claimedMinor??0),0),
 };
}
