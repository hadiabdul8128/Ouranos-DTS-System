import type {Entity} from '../contracts';
import {planningModuleSchema, PLANNING_SCHEMA_VERSION} from '../contracts/planning-module';
import {normalizeAuthorization} from '../../voucher/src/authorization.js';
import {reconcile} from '../../voucher/src/reconcile.js';
import {computePerDiem} from '../../voucher/src/perDiem.js';
import {buildLostReceiptStatement} from '../../voucher/src/lostReceipt.js';
import type {PlanningModuleInput} from '../contracts/planning-module';
import type {VoucherModuleInput} from '../contracts/voucher-module';

export type Allowance=ReturnType<typeof computePerDiem>;
export type ApprovedRevision={id:string;sha256:string;snapshot:{entity:Entity;trip:Entity;perDiem?:Allowance|null}};
export type Resolution=VoucherModuleInput['resolutions'][string];
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
export function planAllowance(trip:Entity,data:PlanningModuleInput):Allowance|null{
  if(!data.allowance?.enabled)return null;
  return computePerDiem({startDate:String(trip.data.departure),endDate:String(trip.data.returnDate),destination:String(trip.data.destination),...data.allowance});
}
export function approvedAllowance(revision:ApprovedRevision):Allowance|null{
  return revision.snapshot.perDiem??planAllowance(revision.snapshot.trip,planningModuleSchema.parse(revision.snapshot.entity.data.formData));
}
export function storedExpenseRows(expenses:Entity[],documents:Entity[]){
  const readyDocuments=new Map(documents.filter(d=>d.status==='ready').map(d=>[d.id,d]));
  return expenses.map(e=>({
    id:e.id,tripId:e.tripId,merchant:e.data.merchant,date:e.data.incurredOn,
    amount:Number(e.data.amountMinor)/100,currency:e.data.currency,category:e.data.category,
    authorizationItemId:e.data.authorizationItemId,paymentMethod:e.data.paymentMethod,
    serviceStartDate:e.data.serviceStartDate,serviceEndDate:e.data.serviceEndDate,
    taxes:Number(e.data.taxesMinor||0)/100,fees:Number(e.data.feesMinor||0)/100,
    receipt:(e.data.documentIds as string[]||[]).map(id=>readyDocuments.get(id)).filter(Boolean).map(d=>({id:d!.id,name:String(d!.data.filename),type:String(d!.data.mediaType),sha256:String(d!.data.sha256),capturedAt:d!.updatedAt}))[0]||null,
  }));
}
export function resolvedStatements(revision:ApprovedRevision,expenses:Entity[],resolutions:Record<string,Resolution>){
 const result:Record<string,any>={};
 for(const [id,resolution] of Object.entries(resolutions)){
  if(resolution.type!=='lost_receipt_statement'){result[id]=resolution;continue}
  const expense=expenses.find(e=>id===`${e.id}:receipt_missing`);
  if(!expense||expense.version!==resolution.value.expenseVersion||expense.data.bookedOnline)continue;
  result[id]={type:resolution.type,value:buildLostReceiptStatement(storedExpenseRows([expense],[])[0],{reason:resolution.value.reason,traveler:approvedTravel(revision).traveler,signedAt:resolution.at||expense.updatedAt})};
 }
 return result;
}
export function reconcileStoredExpenses(revision:ApprovedRevision,expenses:Entity[],documents:Entity[],resolutions:Record<string,Resolution>={}):Reconciliation{
  const perDiem=approvedAllowance(revision);
  const result=reconcile(approvedTravel(revision),storedExpenseRows(expenses,documents),resolvedStatements(revision,expenses,resolutions),{intakeComplete:true,...(perDiem?.supported?{perDiem}:{})}) as Reconciliation;
  for(const e of expenses){
   if(e.data.category==='lodging'&&perDiem?.supported&&(!e.data.serviceStartDate||!e.data.serviceEndDate))result.issues.push({id:`${e.id}:stay_dates`,code:'stay_dates',expenseId:e.id,message:'Add the stay dates.',action:'Edit expense'});
  }
  result.ready=expenses.length>0&&result.issues.length===0;return result;
}
