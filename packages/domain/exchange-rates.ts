import {z} from 'zod';
import {receiptCurrencies,currencyDigits,parseReceiptAmount,receiptAmountText,type ReceiptCurrency} from '../contracts/expense-currency';

const rateSchema=z.object({rate:z.number().min(.000001).max(1_000_000),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export const exchangeRatesSchema=z.object({source:z.literal('Frankfurter'),fetchedAt:z.string().datetime(),rates:z.record(z.enum(receiptCurrencies),rateSchema)});
export type ExchangeRates=z.infer<typeof exchangeRatesSchema>;
export function validateExchangeRates(value:unknown,now=new Date()):ExchangeRates{
 const snapshot=exchangeRatesSchema.parse(value);
 for(const currency of receiptCurrencies){
  const entry=snapshot.rates[currency],date=entry?Date.parse(`${entry.date}T00:00:00Z`):NaN;
  if(!entry||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==entry.date||date>now.getTime()+86400000||now.getTime()-date>7*86400000)throw new Error('Exchange rates are unavailable or out of date. Try again.');
 }
 if(snapshot.rates.USD!.rate!==1)throw new Error('Invalid USD reference rate.');
 return snapshot;
}
export async function fetchExchangeRates(fetcher:typeof fetch=fetch,now=new Date()):Promise<ExchangeRates>{
 const quotes=receiptCurrencies.filter(c=>c!=='USD').join(',');
 const response=await fetcher(`https://api.frankfurter.dev/v2/rates?base=USD&quotes=${quotes}`,{signal:AbortSignal.timeout(8000),next:{revalidate:3600}} as RequestInit);
 if(!response.ok)throw new Error('Exchange rate service unavailable.');
 const rows=z.array(z.object({base:z.literal('USD'),quote:z.enum(receiptCurrencies),...rateSchema.shape})).parse(await response.json());
 if(new Set(rows.map(row=>row.quote)).size!==rows.length)throw new Error('Conflicting exchange rates.');
 return validateExchangeRates({source:'Frankfurter',fetchedAt:now.toISOString(),rates:{USD:{rate:1,date:now.toISOString().slice(0,10)},...Object.fromEntries(rows.map(row=>[row.quote,{rate:row.rate,date:row.date}]))}},now);
}
/** Integer conversion, rounded once in the target currency's minor units. */
export function convertMinor(amount:number,from:ReceiptCurrency,to:ReceiptCurrency,rates:ExchangeRates):number{
 if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid amount.');
 if(from===to)return amount;
 const source=rates.rates[from],target=rates.rates[to];
 if(!source||!target)throw new Error('Exchange rate unavailable.');
 const integerRate=(rate:number)=>BigInt(rate.toFixed(12).replace('.',''));
 const numerator=BigInt(amount)*integerRate(target.rate)*BigInt(10)**BigInt(currencyDigits(to));
 const denominator=integerRate(source.rate)*BigInt(10)**BigInt(currencyDigits(from));
 const result=(numerator+denominator/BigInt(2))/denominator;
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Amount is too large.');
 return Number(result);
}
export type PlanningMoney={amount:string;currency:ReceiptCurrency;usdAmount:string;conversionNote:string};
export function editPlanningAmount(current:PlanningMoney,amount:string,rates:ExchangeRates|null):PlanningMoney{
 const result={...current,amount,usdAmount:'',conversionNote:''};
 if(current.currency==='USD')return result;
 if(!rates)return result;
 try{
  const usd=convertMinor(parseReceiptAmount(amount,current.currency),current.currency,'USD',rates);
  return {...result,usdAmount:receiptAmountText(usd,'USD'),conversionNote:`Frankfurter reference rate: 1 USD = ${rates.rates[current.currency]!.rate} ${current.currency}; ${rates.rates[current.currency]!.date}. Planning estimate.`};
 }catch{return result}
}
export function changePlanningCurrency(current:PlanningMoney,currency:ReceiptCurrency,rates:ExchangeRates|null):PlanningMoney{
 if(currency===current.currency)return current;
 if(!current.amount.trim())return {...current,currency,usdAmount:'',conversionNote:''};
 if(!rates)throw new Error('Exchange rates are unavailable. Retry before changing currency.');
 // Preserve the USD budget across repeated currency switches, avoiding drift
 // from currencies such as JPY that have no fractional minor units.
 const usd=current.currency==='USD'?parseReceiptAmount(current.amount,'USD'):current.usdAmount?parseReceiptAmount(current.usdAmount,'USD'):convertMinor(parseReceiptAmount(current.amount,current.currency),current.currency,'USD',rates);
 const amount=receiptAmountText(convertMinor(usd,'USD',currency,rates),currency);
 return {...current,amount,currency,usdAmount:currency==='USD'?'':receiptAmountText(usd,'USD'),conversionNote:currency==='USD'?'':`Frankfurter reference rate: 1 USD = ${rates.rates[currency]!.rate} ${currency}; ${rates.rates[currency]!.date}. Planning estimate.`};
}
