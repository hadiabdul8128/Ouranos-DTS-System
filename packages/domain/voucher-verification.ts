import {parseReceiptAmount,originalReceiptSchema} from '../contracts/expense-currency';
import type {Entity} from '../contracts';
import type {ApprovedRevision,Reconciliation} from './voucher-adapter';

export const VOUCHER_VERIFICATION_RULE_VERSION='ouranos.voucher.verify.v2';

export type VerificationIssue={id:string;code:string;message:string;action:string;expenseId?:string;documentId?:string};
export type VerificationCheck={code:string;status:'passed'|'resolved';expenseId?:string;documentId?:string};
export type VerificationReport={
 status:'verified'|'needs_action';checkedAt:string;ruleVersion:string;
 voucherId:string;tripId:string;authorizationId:string;authorizationRevisionId:string;
 voucherRevisionId:string;snapshotSha256:string;
 expenseCount:number;receiptCount:number;checksPassed:number;
 claimedTotalMinor:number;gtccTotalMinor:number;personalFundsTotalMinor:number;
 documentIds:string[];receiptEvidence:ReceiptExtraction[];checks:VerificationCheck[];warnings:string[];
 blockingIssues:VerificationIssue[];reconciliation:Reconciliation;
};
export type ReceiptExtraction={documentId:string;amountMinor:number|null;confidence:number;fieldName?:string;currency?:string;currencyConfidence?:number};

/** Accept a provider's explicit paid-total field only. Conflicting candidates
 * stay uncertain rather than promoting an arbitrary OCR number to evidence. */
export function receiptExtractionFromFields(documentId:string,fields:unknown):ReceiptExtraction{
 const values=Array.isArray(fields)?fields:[];
 const currencyFields=values.filter(f=>f&&typeof f==='object'&&f.name==='currency'&&typeof f.value==='string'&&/^[A-Z]{3}$/.test(f.value));
 const currency=currencyFields.length&&new Set(currencyFields.map(f=>f.value)).size===1?currencyFields[0].value as string:undefined;
 if(new Set(currencyFields.map(f=>f.value)).size>1)return {documentId,amountMinor:null,confidence:0};
 const currencyConfidence=currency?Math.min(...currencyFields.map(f=>typeof f.confidence==='number'&&f.confidence>=0&&f.confidence<=1?f.confidence:0)):0;
 const metadata=currency?{currency,currencyConfidence}:{};
 const candidates=values.flatMap(raw=>{
  if(!raw||typeof raw!=='object')return [];
  const field=raw as {name?:unknown;value?:unknown;confidence?:unknown};
  if(!['paid_total','amount','total'].includes(String(field.name)))return [];
  let cents:number;
  try{const value=typeof field.value==='number'?String(field.value):typeof field.value==='string'?field.value.trim().replace(/^\$\s*/,''):'';cents=parseReceiptAmount(value,currency||'USD')}catch{return []}
  const confidence=typeof field.confidence==='number'&&field.confidence>=0&&field.confidence<=1?field.confidence:0;
  return [{name:String(field.name),amountMinor:cents,confidence}];
 });
 if(!candidates.length||new Set(candidates.map(candidate=>candidate.amountMinor)).size!==1)return {documentId,amountMinor:null,confidence:0,...metadata};
 const priority:Record<string,number>={paid_total:0,amount:1,total:2};
 candidates.sort((a,b)=>priority[a.name]-priority[b.name]||b.confidence-a.confidence);
 return {documentId,amountMinor:candidates[0].amountMinor,confidence:candidates[0].confidence,fieldName:candidates[0].name,...metadata};
}

/** This report is built from server-loaded records, never a client verdict. An
 * OCR total is compared only when the provider labeled it with high confidence;
 * a confirmed document remains the traveler's attestation when OCR is unclear. */
export function buildVoucherVerification(input:{
 voucher:Entity;authorizationRevision:ApprovedRevision;voucherRevisionId:string;snapshotSha256:string;
 expenses:Entity[];documents:Entity[];reconciliation:Reconciliation;
 extractions?:ReceiptExtraction[];checkedAt?:string;clientIssueIds?:string[];
}):VerificationReport{
 const {voucher,authorizationRevision,expenses,documents,reconciliation}=input;
 const checks:VerificationCheck[]=[{code:'approved_authorization',status:'passed'},{code:'traveler_certification',status:'passed'},{code:'intake_complete',status:'passed'},{code:'expense_references',status:'passed'},{code:'total_arithmetic',status:'passed'}];
 const warnings:string[]=[];
 const blockingIssues:VerificationIssue[]=reconciliation.issues.map(issue=>({id:issue.id,code:issue.code,message:issue.message,action:issue.action,...(issue.expenseId?{expenseId:issue.expenseId}:{})}));
 for(const raw of reconciliation.checks){
  const check=raw as {code?:unknown;expenseId?:unknown;resolved?:unknown};
  if(typeof check.code!=='string')continue;
  checks.push({code:check.code,status:check.resolved?'resolved':'passed',...(typeof check.expenseId==='string'?{expenseId:check.expenseId}:{})});
  if(check.resolved)warnings.push(`${check.code.replaceAll('_',' ')} was resolved by the traveler; review its explanation in DTS.`);
 }
 const usedIds=new Set<string>();
 for(const expense of expenses){
  for(const id of expense.data.documentIds as string[]||[])usedIds.add(id);
 }
 const documentsById=new Map(documents.map(document=>[document.id,document]));
 const extractionById=new Map((input.extractions||[]).map(extraction=>[extraction.documentId,extraction]));
 for(const id of usedIds){
  const document=documentsById.get(id);
  if(!document||document.status!=='ready'){
   blockingIssues.push({id:`document:${id}:unconfirmed`,code:'receipt_unconfirmed',documentId:id,message:'A linked receipt has not finished processing and been confirmed.',action:'Review and confirm receipt'});
   continue;
  }
  checks.push({code:'receipt_confirmed',status:'passed',documentId:id});
  const linked=expenses.filter(expense=>(expense.data.documentIds as string[]||[]).includes(id));
  if(linked.length!==1){blockingIssues.push({id:`document:${id}:reused`,code:'receipt_reused',documentId:id,message:'The same receipt is linked to multiple expenses. Separate or correct the expense evidence.',action:'Review receipt allocation'});continue}
  const extraction=extractionById.get(id);
  if(!extraction||extraction.amountMinor===null){warnings.push(`Receipt ${id} has no reliable OCR total; the traveler confirmed the original.`);continue}
  if(extraction.confidence<.85){warnings.push(`Receipt ${id} has an uncertain OCR total; the traveler confirmed the original.`);continue}
  const original=originalReceiptSchema.safeParse(linked[0].data.originalReceipt);
  const expectedCurrency=original.success?original.data.currency:String(linked[0].data.currency);
  if(extraction.currency&&extraction.currencyConfidence!==undefined&&extraction.currencyConfidence>=.85&&extraction.currency!==expectedCurrency){
   if(typeof linked[0].data.receiptCurrencyCorrection==='string'&&linked[0].data.receiptCurrencyCorrection.trim().length>=8){
    warnings.push(`Receipt ${id} currency was corrected by the traveler: ${linked[0].data.receiptCurrencyCorrection}`);
    checks.push({code:'receipt_currency_corrected',status:'resolved',expenseId:linked[0].id,documentId:id});
   }else{
    blockingIssues.push({id:`${linked[0].id}:receipt_currency_mismatch`,code:'receipt_currency_mismatch',expenseId:linked[0].id,documentId:id,message:'Receipt currency differs from the expense. Check the original and correct the currency, or explain an OCR currency error.',action:'Review expense currency'});continue;
   }
  }
  if(original.success){
   warnings.push(`Expense ${linked[0].id} uses a traveler-supplied USD amount (${original.data.usdBasis.replaceAll('_',' ')}). Original: ${original.data.currency}; conversion evidence remains subject to DTS review.`);
   // Do not compare units when OCR currency is missing/uncertain or corrected.
   if(extraction.currency!==expectedCurrency||(extraction.currencyConfidence||0)<.85){warnings.push(`Receipt ${id} original currency/total needs traveler confirmation.`);continue}
  }else if(extraction.currency&&extraction.currency!==expectedCurrency)continue;
  const expectedAmount=original.success?original.data.amountMinor:linked[0].data.amountMinor;
  if(expectedAmount!==extraction.amountMinor){

   blockingIssues.push({id:`${linked[0].id}:receipt_total_mismatch`,code:'receipt_total_mismatch',expenseId:linked[0].id,documentId:id,message:'The expense amount differs from the receipt total. Check the original receipt and correct the expense or attach the right receipt.',action:'Review expense and receipt'});
  }else checks.push({code:'receipt_total_match',status:'passed',expenseId:linked[0].id,documentId:id});
 }
 if(!reconciliation.ready&&!blockingIssues.length)blockingIssues.push({id:'voucher:reconciliation',code:'reconciliation_incomplete',message:'Complete the expense reconciliation before verification.',action:'Review voucher'});
 if(input.clientIssueIds?.some(id=>!blockingIssues.some(issue=>issue.id===id)))blockingIssues.push({id:'voucher:open_issues',code:'open_issues',message:'Refresh the voucher and resolve the listed items before verification.',action:'Review voucher'});
 const claimedTotalMinor=expenses.reduce((sum,e)=>sum+Number(e.data.amountMinor),0);
 const gtccTotalMinor=expenses.filter(e=>e.data.paymentMethod==='gtcc').reduce((sum,e)=>sum+Number(e.data.amountMinor),0);
 const personalFundsTotalMinor=expenses.filter(e=>e.data.paymentMethod==='personal').reduce((sum,e)=>sum+Number(e.data.amountMinor),0);
 const status=blockingIssues.length?'needs_action':'verified';
 return {status,checkedAt:input.checkedAt||new Date().toISOString(),ruleVersion:VOUCHER_VERIFICATION_RULE_VERSION,
  voucherId:voucher.id,tripId:voucher.tripId!,authorizationId:String(voucher.data.authorizationId),authorizationRevisionId:authorizationRevision.id,
  voucherRevisionId:input.voucherRevisionId,snapshotSha256:input.snapshotSha256,
  expenseCount:expenses.length,receiptCount:[...usedIds].filter(id=>documentsById.get(id)?.status==='ready').length,checksPassed:checks.length,
  claimedTotalMinor,gtccTotalMinor,personalFundsTotalMinor,documentIds:[...usedIds].sort(),receiptEvidence:[...(input.extractions||[])].sort((a,b)=>a.documentId.localeCompare(b.documentId)),checks,warnings,blockingIssues,reconciliation};
}
