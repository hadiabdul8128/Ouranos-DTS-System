import {z} from 'zod';

// USD remains the authorization/reconciliation currency. These are original
// receipt currencies, not rates or a promise of reimbursement.
export const receiptCurrencies=['USD','EUR','GBP','CAD','AUD','NZD','CHF','JPY','KRW','MXN','INR','AED','SAR','SGD','HKD','PHP','THB','TWD','CNY','BHD','KWD'] as const;
export type ReceiptCurrency=typeof receiptCurrencies[number];
export const currencyDigits=(currency:string)=>['JPY','KRW'].includes(currency)?0:['BHD','KWD'].includes(currency)?3:2;
export function parseReceiptAmount(value:string,currency:string):number{
 const digits=currencyDigits(currency),clean=value.trim();
 if(!receiptCurrencies.includes(currency as ReceiptCurrency)||!new RegExp(`^(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,${Math.max(1,digits)}})?$`).test(clean))throw new Error(`Enter a valid ${currency} amount.`);
 const [whole,fraction='']=clean.replaceAll(',','').split('.');
 if(fraction.length>digits)throw new Error(`${currency} amounts use ${digits} decimal places.`);
 const minor=BigInt(whole)*BigInt(10)**BigInt(digits)+BigInt(fraction.padEnd(digits,'0')||'0');
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Amount is too large.');
 return Number(minor);
}
export function receiptAmountText(minor:number,currency:string){const digits=currencyDigits(currency),value=String(minor).padStart(digits+1,'0');return digits?`${value.slice(0,-digits)}.${value.slice(-digits)}`:value}
export function formatReceiptAmount(minor:number,currency:string){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(minor/10**currencyDigits(currency))}
const minor=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const originalReceiptSchema=z.object({
 currency:z.enum(receiptCurrencies).refine(c=>c!=='USD','Use original receipt details only for foreign currency'),
 amountMinor:minor.refine(n=>n>0,'Original receipt total must be positive'),
 taxesMinor:minor.default(0),feesMinor:minor.default(0),
 usdBasis:z.enum(['card_statement','documented_conversion']),
 conversionNote:z.string().trim().max(2000).default(''),
}).strict().refine(v=>BigInt(v.taxesMinor)+BigInt(v.feesMinor)<=BigInt(v.amountMinor),'Original tax and fees cannot exceed receipt total').refine(v=>v.usdBasis!=='documented_conversion'||v.conversionNote.length>=8,'Describe the documented conversion used');
export type OriginalReceipt=z.infer<typeof originalReceiptSchema>;
/** Allocate confirmed USD tax/fees proportionally, with integer rounding and
 * one cumulative boundary so the parts cannot exceed the confirmed USD total. */
export function convertedBreakdown(original:OriginalReceipt,usdTotal:number){
 const total=BigInt(original.amountMinor),usd=BigInt(usdTotal);
 const rounded=(part:number)=>Number((BigInt(part)*usd+total/BigInt(2))/total);
 const taxesMinor=rounded(original.taxesMinor);
 return {taxesMinor,feesMinor:rounded(original.taxesMinor+original.feesMinor)-taxesMinor};
}
