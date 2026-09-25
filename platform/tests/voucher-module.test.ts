import {describe,it,expect} from 'vitest';
import {VOUCHER_MODULE_SCHEMA_VERSION,voucherModuleSchema,type VoucherModuleInput} from '../../packages/contracts/voucher-module';
import {validateVoucher} from '../../modules/vouchers/validator';

function submission():VoucherModuleInput{
 return {
  tripId:crypto.randomUUID(),authorizationId:crypto.randomUUID(),currency:'USD',certified:true,intakeComplete:true,
  expenseItems:[
   {expenseId:crypto.randomUUID(),authorizationItemId:crypto.randomUUID(),amountMinor:18200,currency:'USD',documentIds:[crypto.randomUUID()]},
   {expenseId:crypto.randomUUID(),authorizationItemId:crypto.randomUUID(),amountMinor:1250,currency:'USD',documentIds:[]},
  ],
  reconciliation:{totalAmountMinor:19450,unresolvedIssueIds:[]},resolutions:{},
 };
}

describe('Voucher Copilot platform submission boundary',()=>{
 it('accepts a consistent real module submission outside development',()=>{
  expect(validateVoucher(VOUCHER_MODULE_SCHEMA_VERSION,submission(),false)).toEqual([]);
 });
 it('requires certification, finished intake, and no unresolved issues',()=>{
  for(const change of [{certified:false},{intakeComplete:false},{reconciliation:{totalAmountMinor:19450,unresolvedIssueIds:['expense:receipt_missing']}}]){
   expect(voucherModuleSchema.safeParse({...submission(),...change}).success).toBe(false);
  }
 });
 it('rejects dollar amounts, unsafe totals, and mismatched arithmetic',()=>{
  const fractional=submission();fractional.expenseItems[0].amountMinor=182.5;
  expect(voucherModuleSchema.safeParse(fractional).success).toBe(false);
  const mismatch=submission();mismatch.reconciliation.totalAmountMinor=19449;
  expect(voucherModuleSchema.safeParse(mismatch).success).toBe(false);
  const overflow=submission();overflow.expenseItems[0].amountMinor=Number.MAX_SAFE_INTEGER;
  expect(voucherModuleSchema.safeParse(overflow).success).toBe(false);
 });
 it('requires unique platform expense and receipt references',()=>{
  const duplicateExpense=submission();duplicateExpense.expenseItems[1].expenseId=duplicateExpense.expenseItems[0].expenseId;
  expect(voucherModuleSchema.safeParse(duplicateExpense).success).toBe(false);
  const duplicateReceipt=submission();duplicateReceipt.expenseItems[0].documentIds.push(duplicateReceipt.expenseItems[0].documentIds[0]);
  expect(voucherModuleSchema.safeParse(duplicateReceipt).success).toBe(false);
  expect(voucherModuleSchema.safeParse({...submission(),tripId:'TDY-123'}).success).toBe(false);
 });
 it('rejects unsupported currency and extra client approval claims',()=>{
  expect(voucherModuleSchema.safeParse({...submission(),currency:'EUR'}).success).toBe(false);
  expect(voucherModuleSchema.safeParse({...submission(),approved:true}).success).toBe(false);
 });
 it('preserves reviewable exception resolutions and rejects empty explanations',()=>{
  const input=submission();const itemId=input.expenseItems[0].authorizationItemId;
  input.resolutions={
   [`${input.expenseItems[0].expenseId}:over_authorization`]:{type:'explanation',value:'Conference rate was unavailable',at:'2026-09-25T05:00:00Z'},
   [`auth:${itemId}:not_used`]:{type:'not_used',value:itemId},
  };
  expect(voucherModuleSchema.parse(input).resolutions).toEqual(input.resolutions);
  expect(voucherModuleSchema.safeParse({...input,resolutions:{x:{type:'explanation',value:'  '}}}).success).toBe(false);
  expect(voucherModuleSchema.safeParse({...input,resolutions:{x:{type:'confirmed_date',value:'2026-02-30'}}}).success).toBe(false);
 });
 it('retains the fixture only in development and rejects unknown form versions',()=>{
  expect(validateVoucher('ouranos.fixture.v1',{certified:true},true)).toEqual([]);
  expect(validateVoucher('ouranos.fixture.v1',{certified:true},false)).not.toEqual([]);
  expect(validateVoucher('unregistered',submission(),true)).not.toEqual([]);
 });
});
