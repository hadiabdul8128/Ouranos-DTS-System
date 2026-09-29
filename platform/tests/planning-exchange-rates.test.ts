import {describe,expect,it} from 'vitest';
import {receiptCurrencies} from '../../packages/contracts/expense-currency';
import {changePlanningCurrency,editPlanningAmount,convertMinor,validateExchangeRates,fetchExchangeRates,type ExchangeRates,type PlanningMoney} from '../../packages/domain/exchange-rates';
import {vi} from 'vitest';
const now=new Date('2026-09-29T12:00:00Z');
const rates:ExchangeRates={source:'Frankfurter',fetchedAt:now.toISOString(),rates:Object.fromEntries(receiptCurrencies.map(currency=>[currency,{rate:currency==='INR'?95.81:currency==='EUR'?.8773:currency==='JPY'?157.46:currency==='KWD'?.30811:1,date:'2026-09-29'}]))};
const usd:PlanningMoney={amount:'33',currency:'USD',usdAmount:'',conversionNote:''};
const rows=Object.entries(rates.rates).filter(([currency])=>currency!=='USD').map(([quote,entry])=>({base:'USD',quote,...entry}));
describe('one amount field with automatic currency conversion',()=>{
 it('converts USD to INR and back without changing the approval budget',()=>{
  const inr=changePlanningCurrency(usd,'INR',rates);
  expect(inr).toMatchObject({amount:'3161.73',currency:'INR',usdAmount:'33.00'});
  expect(inr.conversionNote).toContain('95.81 INR; 2026-09-29');
  expect(changePlanningCurrency(inr,'USD',rates)).toEqual({...usd,amount:'33.00'});
 });
 it('avoids repeated rounding drift through zero- and three-decimal currencies',()=>{
  let value={...usd,amount:'33.01'};
  for(let i=0;i<10;i++)for(const currency of ['JPY','KWD','EUR','INR','USD'] as const)value=changePlanningCurrency(value,currency,rates);
  expect(value.amount).toBe('33.01');
  expect(convertMinor(10000,'USD','JPY',rates)).toBe(15746);
  expect(convertMinor(10000,'USD','KWD',rates)).toBe(30811);
 });
 it('recalculates USD when the traveler changes a foreign amount, and clears invalid estimates',()=>{
  const inr=changePlanningCurrency(usd,'INR',rates);
  expect(editPlanningAmount(inr,'958.10',rates).usdAmount).toBe('10.00');
  expect(editPlanningAmount(inr,'not money',rates).usdAmount).toBe('');
  expect(editPlanningAmount(inr,'958.10',null).usdAmount).toBe('');
 });
 it('supports selecting a currency before entering money and safely rejects failed conversions',()=>{
  expect(changePlanningCurrency({...usd,amount:''},'EUR',null)).toMatchObject({amount:'',currency:'EUR'});
  expect(()=>changePlanningCurrency(usd,'EUR',null)).toThrow('unavailable');
  expect(()=>changePlanningCurrency({...usd,amount:'nonsense'},'EUR',rates)).toThrow();
 });
 it('fetches anonymous rates only, validates coverage and rejects stale or malformed evidence',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json(rows));
  const result=await fetchExchangeRates(fetcher,now);
  expect(result.rates.INR).toEqual(rates.rates.INR);
  expect(fetcher.mock.calls[0][0]).toContain('base=USD&quotes=EUR');
  expect(fetcher.mock.calls[0][0]).not.toContain('33');
  expect(()=>validateExchangeRates({...rates,rates:{USD:rates.rates.USD}},now)).toThrow();
  expect(()=>validateExchangeRates(rates,new Date('2026-10-10'))).toThrow();
  expect(()=>validateExchangeRates({...rates,rates:{...rates.rates,INR:{rate:-2,date:'2026-09-29'}}},now)).toThrow();
  await expect(fetchExchangeRates(vi.fn().mockResolvedValue(Response.json([...rows,rows[0]])),now)).rejects.toThrow('Conflicting');
  await expect(fetchExchangeRates(vi.fn().mockResolvedValue(new Response('',{status:503})),now)).rejects.toThrow('unavailable');
 });
});
