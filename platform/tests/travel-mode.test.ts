import {describe,expect,it} from 'vitest';
import {mileageMinor,travelModeSummary} from '../../packages/domain/travel-mode';
import {planningModuleSchema} from '../../packages/contracts/planning-module';

const item={id:'00000000-0000-4000-8000-000000000001',category:'ground_transport',description:'Mileage',authorizedAmountMinor:29400};
describe('travel mode',()=>{
 it('estimates mileage in cents and rejects blank or zero input',()=>{
  expect(mileageMinor(420,70)).toBe(29400);
  expect(mileageMinor(12.5,67)).toBe(838);
  expect(mileageMinor(0,70)).toBeNull();expect(mileageMinor(Number(''),70)).toBeNull();expect(mileageMinor(420,Number.NaN)).toBeNull();
 });
 it('describes how the traveler gets there',()=>{
  expect(travelModeSummary('pov',{miles:420,centsPerMile:70})).toBe('Driving my own car · 420 miles at $0.70/mile');
  expect(travelModeSummary('government')).toBe('Government vehicle');
  expect(travelModeSummary(undefined)).toBe('Not given');
 });
 it('keeps plans without a travel mode valid and accepts one with mileage',()=>{
  const base={traveler:'A',origin:'Austin, TX',currency:'USD' as const,approvedExpenseItems:[item]};
  expect(planningModuleSchema.safeParse(base).success).toBe(true);
  expect(planningModuleSchema.safeParse({...base,travelMode:'pov',mileage:{miles:420,centsPerMile:70}}).success).toBe(true);
  expect(planningModuleSchema.safeParse({...base,travelMode:'boat'}).success).toBe(false);
 });
});
