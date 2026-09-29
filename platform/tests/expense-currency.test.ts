import {describe,expect,it} from 'vitest';
import {expenseInput} from '../../packages/contracts';
import {parseReceiptAmount,receiptAmountText,originalReceiptSchema,convertedBreakdown} from '../../packages/contracts/expense-currency';

const original={currency:'EUR' as const,amountMinor:10000,taxesMinor:1500,feesMinor:500,usdBasis:'card_statement' as const,conversionNote:''};
const expense={tripId:crypto.randomUUID(),merchant:'Hotel',incurredOn:'2026-10-12',amountMinor:11000,currency:'USD',category:'lodging',taxesMinor:1650,feesMinor:550,originalReceipt:original};
describe('confirmed receipt currency and USD normalization',()=>{
 it('parses decimal units exactly for dollars, yen and dinars',()=>{
  expect(parseReceiptAmount('1,234.56','EUR')).toBe(123456);
  expect(parseReceiptAmount('12,345','JPY')).toBe(12345);
  expect(parseReceiptAmount('10.125','KWD')).toBe(10125);
  expect(receiptAmountText(10125,'KWD')).toBe('10.125');
  expect(()=>parseReceiptAmount('12.50','JPY')).toThrow();
  expect(()=>parseReceiptAmount('1.234','USD')).toThrow();
  expect(()=>parseReceiptAmount('1,23','EUR')).toThrow();
  expect(()=>parseReceiptAmount('9007199254740992','JPY')).toThrow();
 });
 it('retains original money and confirmed USD while rejecting missing or inconsistent conversion evidence',()=>{
  expect(expenseInput.parse(expense).originalReceipt).toEqual(original);
  expect(expenseInput.safeParse({...expense,currency:'EUR'}).success).toBe(false);
  expect(expenseInput.safeParse({...expense,amountMinor:0}).success).toBe(false);
  expect(expenseInput.safeParse({...expense,taxesMinor:1500}).success).toBe(false);
  expect(originalReceiptSchema.safeParse({...original,usdBasis:'documented_conversion'}).success).toBe(false);
  expect(originalReceiptSchema.safeParse({...original,usdBasis:'documented_conversion',conversionNote:'Rate 1.10, card issuer on Oct 12'}).success).toBe(true);
  expect(originalReceiptSchema.safeParse({...original,taxesMinor:10000,feesMinor:1}).success).toBe(false);
  expect(expenseInput.safeParse({...expense,originalReceipt:undefined}).success).toBe(true);
 });
 it('allocates converted lodging parts without rounding past the confirmed USD total',()=>{
  expect(convertedBreakdown(original,11000)).toEqual({taxesMinor:1650,feesMinor:550});
  expect(convertedBreakdown({...original,amountMinor:2,taxesMinor:1,feesMinor:1},1)).toEqual({taxesMinor:1,feesMinor:0});
 });
});
