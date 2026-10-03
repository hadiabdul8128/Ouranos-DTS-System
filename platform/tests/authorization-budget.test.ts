import {describe,expect,it} from 'vitest';
import {authorizationBudget} from '../../packages/domain/authorization-budget';
import {computePerDiem} from '../../voucher/src/perDiem.js';

const trip={destination:'Chapel Hill, NC',departure:'2026-10-09',returnDate:'2026-10-15'};
const flight={category:'airfare',authorizedAmountMinor:10000};
const settings={enabled:true,governmentMess:false,mealsProvided:{}};
describe('optional authorization meals estimate',()=>{
 it('adds meals once to flight and hotel expenses, without adding the lodging limit',()=>{
  const estimate=computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination});
  const budget=authorizationBudget(trip,{allowance:settings,approvedExpenseItems:[flight,{category:'lodging',authorizedAmountMinor:60000}]});
  expect(budget).toEqual({expensesMinor:70000,mealsMinor:52000,totalMinor:122000,mealsIncluded:true});
  expect(estimate.totals.lodgingCap).toBeGreaterThan(0);
 });
 it('excludes meals when the traveler opts out, the rate is unsupported, or a meals line already exists',()=>{
  expect(authorizationBudget(trip,{allowance:{...settings,enabled:false},approvedExpenseItems:[flight]}).totalMinor).toBe(10000);
  expect(authorizationBudget({...trip,destination:'Tokyo, JP'},{allowance:settings,approvedExpenseItems:[flight]}).mealsMinor).toBe(0);
  expect(authorizationBudget(trip,{allowance:settings,approvedExpenseItems:[flight,{category:'meals',authorizedAmountMinor:52000}]})).toMatchObject({mealsMinor:0,totalMinor:62000});
 });
 it('adjusts for expected free meals and uses the frozen submission amount when rates differ',()=>{
  const form={allowance:{...settings,mealsProvided:{'2026-10-10':{lunch:true}}},approvedExpenseItems:[flight]};
  expect(authorizationBudget(trip,form).mealsMinor).toBeLessThan(52000);
  const frozen=computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination});
  frozen.totals.mie=123.45;
  expect(authorizationBudget(trip,form,frozen).totalMinor).toBe(22345);
 });
});
