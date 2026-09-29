import {describe,expect,it} from 'vitest';
import type {Entity} from '../../packages/contracts';
import type {ApprovedRevision,Reconciliation} from '../../packages/domain/voucher-adapter';
import {buildVoucherVerification,receiptExtractionFromFields} from '../../packages/domain/voucher-verification';
import {voucherModuleSchema,voucherVerificationCandidateSchema} from '../../packages/contracts/voucher-module';

const tripId='00000000-0000-4000-8000-000000000001',authorizationId='00000000-0000-4000-8000-000000000002';
const expenseId='00000000-0000-4000-8000-000000000003',documentId='00000000-0000-4000-8000-000000000004';
const voucher:Entity={id:'00000000-0000-4000-8000-000000000005',kind:'voucher',organizationId:'00000000-0000-4000-8000-000000000006',tripId,version:1,status:'draft',data:{authorizationId},updatedAt:'2026-10-16T00:00:00Z'};
const expense:Entity={id:expenseId,kind:'expense',organizationId:voucher.organizationId,tripId,version:1,status:'draft',data:{merchant:'Hotel',amountMinor:62100,currency:'USD',paymentMethod:'gtcc',documentIds:[documentId]},updatedAt:voucher.updatedAt};
const receipt:Entity={id:documentId,kind:'document',organizationId:voucher.organizationId,tripId,version:2,status:'ready',data:{filename:'hotel.pdf',sha256:'a'.repeat(64)},updatedAt:voucher.updatedAt};
const approved={id:'00000000-0000-4000-8000-000000000007',sha256:'b'.repeat(64),snapshot:{entity:{} as Entity,trip:{} as Entity}} as ApprovedRevision;
const clean:Reconciliation={ready:true,issues:[],checks:[{code:'authorized_category',expenseId},{code:'receipt',expenseId}],totals:{authorized:570,actual:621,gtcc:621,traveler:0}};
const report=(changes:Partial<Parameters<typeof buildVoucherVerification>[0]>={})=>buildVoucherVerification({voucher,authorizationRevision:approved,voucherRevisionId:'00000000-0000-4000-8000-000000000008',snapshotSha256:'c'.repeat(64),expenses:[expense],documents:[receipt],reconciliation:clean,checkedAt:'2026-10-16T00:00:00Z',...changes});

describe('server Voucher verification report',()=>{
 it('reads explicit numeric or formatted paid totals and leaves conflicting OCR totals uncertain',()=>{
  expect(receiptExtractionFromFields(documentId,[{name:'amount',value:621,confidence:.91}])).toMatchObject({amountMinor:62100,confidence:.91});
  expect(receiptExtractionFromFields(documentId,[{name:'total',value:'$1,234.56',confidence:.93}])).toMatchObject({amountMinor:123456,confidence:.93});
  expect(receiptExtractionFromFields(documentId,[{name:'subtotal',value:'600.00',confidence:.99}]).amountMinor).toBeNull();
  expect(receiptExtractionFromFields(documentId,[{name:'amount',value:'621.00',confidence:.9},{name:'paid_total',value:'630.00',confidence:.9}]).amountMinor).toBeNull();
  expect(receiptExtractionFromFields(documentId,[{name:'total',value:'Total maybe 621.00',confidence:.9}]).amountMinor).toBeNull();
 });
 it('verifies confirmed evidence and freezes counts, totals and provenance',()=>{
  const result=report({extractions:[{documentId,amountMinor:62100,confidence:.92}]});
  expect(result.status).toBe('verified');expect(result.blockingIssues).toEqual([]);
  expect(result.receiptCount).toBe(1);expect(result.expenseCount).toBe(1);
  expect(result.claimedTotalMinor).toBe(62100);expect(result.gtccTotalMinor).toBe(62100);
  expect(result.authorizationRevisionId).toBe(approved.id);expect(result.snapshotSha256).toBe('c'.repeat(64));
  expect(result.receiptEvidence).toEqual([{documentId,amountMinor:62100,confidence:.92}]);
  expect(result.checks).toContainEqual({code:'receipt_total_match',status:'passed',expenseId,documentId});
 });
 it.each([
  ['missing receipt','receipt_missing'],['duplicate expense','possible_duplicate'],['date discrepancy','itinerary_changed'],
 ])('returns %s to the traveler',(_name,code)=>{
  const result=report({reconciliation:{...clean,ready:false,issues:[{id:`${expenseId}:${code}`,code,message:`Fix ${code}`,action:'Edit expense',expenseId}]}});
  expect(result.status).toBe('needs_action');expect(result.blockingIssues[0]).toMatchObject({code,action:'Edit expense'});
 });
 it('blocks unconfirmed evidence and high-confidence receipt amount mismatches',()=>{
  expect(report({documents:[{...receipt,status:'needs_review'}]}).blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_unconfirmed'}));
  expect(report({extractions:[{documentId,amountMinor:62000,confidence:.92}]}).blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_total_mismatch'}));
  expect(report({extractions:[{documentId,amountMinor:62000,confidence:.3}]}).status).toBe('verified');
 });
 it('rejects a reused receipt and does not trust an empty client issue list',()=>{
  const reused={...expense,id:'00000000-0000-4000-8000-000000000009'};
  expect(report({expenses:[expense,reused]}).blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_reused'}));
  expect(report({reconciliation:{...clean,ready:false,issues:[{id:'issue',code:'outside_dates',message:'Outside trip',action:'Edit expense'}]},clientIssueIds:[]}).status).toBe('needs_action');
 });
});

describe('verification candidate contract',()=>{
 const candidate={tripId,authorizationId,currency:'USD',certified:true,intakeComplete:true,expenseItems:[{expenseId,authorizationItemId:authorizationId,amountMinor:62100,currency:'USD',documentIds:[documentId]}],reconciliation:{totalAmountMinor:62100,unresolvedIssueIds:['receipt_missing']},resolutions:{}};
 it('accepts open issues for an attempt but not for a verified voucher',()=>{
  expect(voucherVerificationCandidateSchema.safeParse(candidate).success).toBe(true);
  expect(voucherModuleSchema.safeParse(candidate).success).toBe(false);
 });
 it('requires certification and consistent integer totals',()=>{
  expect(voucherVerificationCandidateSchema.safeParse({...candidate,certified:false}).success).toBe(false);
  expect(voucherVerificationCandidateSchema.safeParse({...candidate,reconciliation:{...candidate.reconciliation,totalAmountMinor:1}}).success).toBe(false);
 });
});

describe('foreign receipt evidence',()=>{
 const foreignExpense={...expense,data:{...expense.data,amountMinor:11000,originalReceipt:{currency:'EUR',amountMinor:10000,taxesMinor:0,feesMinor:0,usdBasis:'card_statement',conversionNote:''}}};
 it('compares the original receipt total and keeps the confirmed USD voucher total',()=>{
  const evidence=receiptExtractionFromFields(documentId,[{name:'amount',value:'100.00',confidence:.95},{name:'currency',value:'EUR',confidence:.95}]);
  const result=report({expenses:[foreignExpense],extractions:[evidence]});
  expect(result.status).toBe('verified');expect(result.claimedTotalMinor).toBe(11000);
  expect(result.checks).toContainEqual({code:'receipt_total_match',status:'passed',expenseId,documentId});
  expect(report({expenses:[foreignExpense],extractions:[{...evidence,amountMinor:11000}]}).blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_total_mismatch'}));
 });
 it('blocks an unrecorded currency mismatch, and audits traveler OCR corrections',()=>{
  const evidence={documentId,amountMinor:10000,confidence:.95,currency:'USD',currencyConfidence:.95};
  expect(report({expenses:[foreignExpense],extractions:[evidence]}).blockingIssues).toContainEqual(expect.objectContaining({code:'receipt_currency_mismatch'}));
  const corrected={...foreignExpense,data:{...foreignExpense.data,receiptCurrencyCorrection:'Original receipt clearly shows EUR, OCR read USD'}};
  const result=report({expenses:[corrected],extractions:[evidence]});
  expect(result.status).toBe('verified');expect(result.warnings.join(' ')).toContain('OCR read USD');
  expect(result.checks.some(c=>c.code==='receipt_total_match')).toBe(false);
 });
 it('does not compare uncertain currency units or invent an OCR currency',()=>{
  const result=report({expenses:[foreignExpense],extractions:[{documentId,amountMinor:11000,confidence:.95}]});
  expect(result.status).toBe('verified');expect(result.checks.some(c=>c.code==='receipt_total_match')).toBe(false);
  expect(result.warnings.join(' ')).toContain('needs traveler confirmation');
  expect(receiptExtractionFromFields(documentId,[{name:'currency',value:'JPY',confidence:.95},{name:'amount',value:'12345',confidence:.95}]).amountMinor).toBe(12345);
  expect(receiptExtractionFromFields(documentId,[{name:'currency',value:'KWD',confidence:.95},{name:'amount',value:'10.125',confidence:.95}]).amountMinor).toBe(10125);
  expect(receiptExtractionFromFields(documentId,[{name:'currency',value:'EUR'},{name:'currency',value:'USD'},{name:'amount',value:'100.00',confidence:.95}]).amountMinor).toBeNull();
 });
});
