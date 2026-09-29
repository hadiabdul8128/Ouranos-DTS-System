import {describe,expect,it} from 'vitest';
import {planningModuleSchema,plannedExpenseSchema} from '../../packages/contracts/planning-module';
import {approvedTravel,type ApprovedRevision} from '../../packages/domain/voucher-adapter';
const item={id:crypto.randomUUID(),category:'rental_car',description:'Rental car in Paris',authorizedAmountMinor:22000,originalEstimate:{currency:'EUR',amountMinor:20000,conversionNote:'1 EUR = 1.10 USD, estimate dated Oct 1'}};
describe('foreign planned expense estimates',()=>{
 it('retains the original quote while handing the approved USD budget to Voucher',()=>{
  const form=planningModuleSchema.parse({traveler:'Alex',origin:'Raleigh, NC',currency:'USD',approvedExpenseItems:[item]});
  expect(form.approvedExpenseItems[0].originalEstimate).toEqual(item.originalEstimate);
  const revision={id:crypto.randomUUID(),sha256:'test',snapshot:{entity:{id:crypto.randomUUID(),data:{formSchemaVersion:'ouranos.planning.v1',formData:form}},trip:{id:crypto.randomUUID(),data:{destination:'Paris',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'TDY'}}}} as unknown as ApprovedRevision;
  expect(approvedTravel(revision).authorizedItems[0].amount).toBe(220);
 });
 it('requires a positive original quote and documented estimate without changing legacy USD plans',()=>{
  expect(plannedExpenseSchema.safeParse({...item,originalEstimate:undefined}).success).toBe(true);
  expect(plannedExpenseSchema.safeParse({...item,originalEstimate:{...item.originalEstimate,amountMinor:0}}).success).toBe(false);
  expect(plannedExpenseSchema.safeParse({...item,originalEstimate:{...item.originalEstimate,conversionNote:''}}).success).toBe(false);
  expect(plannedExpenseSchema.safeParse({...item,originalEstimate:{...item.originalEstimate,currency:'USD'}}).success).toBe(false);
 });
});
