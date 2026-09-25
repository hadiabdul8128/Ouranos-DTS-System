import type {Entity} from '../contracts';
import {planningModuleSchema, PLANNING_SCHEMA_VERSION, travelCategories} from '../contracts/planning-module';
import {normalizeAuthorization} from '../../voucher/src/authorization.js';
import {reconcile} from '../../voucher/src/reconcile.js';
import {parseReceiptText} from '../../voucher/src/receiptParser.js';
import {suggestAssignment} from '../../voucher/src/matching.js';

export type ApprovedRevision={id:string;sha256:string;snapshot:{entity:Entity;trip:Entity}};
export type Resolution={type:'explanation'|'confirmed_date'|'not_used';value:string;at?:string};
export type Reconciliation={ready:boolean;issues:Array<{id:string;code:string;message:string;action:string;expenseId?:string;authorizationItemId?:string}>;checks:unknown[];totals:{authorized:number;actual:number;gtcc:number;traveler:number}};

/** Only feed this adapter an immutable revision selected by the server after
 * its approval request reaches approved. Browser handoff events confer no authority. */
export function approvedTravel(revision:ApprovedRevision){
  const {entity,trip}=revision.snapshot;
  if(entity.data.formSchemaVersion!==PLANNING_SCHEMA_VERSION)throw new Error('This authorization uses a planning form that is not supported by the connected voucher.');
  const data=planningModuleSchema.parse(entity.data.formData);
  return normalizeAuthorization({
    tripId:trip.id,authorizationId:entity.id,status:'Approved',traveler:data.traveler,origin:data.origin,
    destination:trip.data.destination,departureDate:trip.data.departure,returnDate:trip.data.returnDate,
    purpose:trip.data.purpose,currency:data.currency,
    approvedExpenseItems:data.approvedExpenseItems.map(({authorizedAmountMinor,...item})=>({...item,authorizedAmount:authorizedAmountMinor/100})),
  });
}

/** Suggest an approved item using the immutable approval and the receipt's reviewed OCR fields.
 * Only structured paid totals are used; an uncertain OCR amount stays blank. */
export function suggestReceiptAllocation(revision:ApprovedRevision,fields:Record<string,string>,hint=''){
  const parsed=parseReceiptText(fields.rawText||'').fields;
  const amount=/^\d+(?:\.\d{1,2})?$/.test(fields.amount||'')?Number(fields.amount):null;
  const category=travelCategories.includes(fields.category as typeof travelCategories[number])&&fields.category!=='other'?fields.category:parsed.category;
  return suggestAssignment(approvedTravel(revision),{
    merchant:fields.merchant||parsed.merchant,
    date:/^\d{4}-\d{2}-\d{2}$/.test(fields.date||'')?fields.date:'',
    amount,
    category,
    location:fields.location||parsed.location,
    serviceStartDate:fields.serviceStartDate||parsed.serviceStartDate,
    serviceEndDate:fields.serviceEndDate||parsed.serviceEndDate,
    paymentMethod:fields.paymentMethod||parsed.paymentMethod,
  },hint,[]);
}
export function reconcileStoredExpenses(revision:ApprovedRevision,expenses:Entity[],documents:Entity[],resolutions:Record<string,Resolution>={}):Reconciliation{
  const readyDocuments=new Set(documents.filter(d=>d.status==='ready').map(d=>d.id));
  const rows=expenses.map(e=>({
    id:e.id,tripId:e.tripId,merchant:e.data.merchant,date:e.data.incurredOn,
    amount:Number(e.data.amountMinor)/100,currency:e.data.currency,category:e.data.category,
    authorizationItemId:e.data.authorizationItemId,paymentMethod:e.data.paymentMethod,
    serviceStartDate:e.data.serviceStartDate,serviceEndDate:e.data.serviceEndDate,
    receipt:(e.data.documentIds as string[]||[]).some(id=>readyDocuments.has(id))?{name:'Verified receipt'}:null,
  }));
  return reconcile(approvedTravel(revision),rows,resolutions,{intakeComplete:true}) as Reconciliation;
}
