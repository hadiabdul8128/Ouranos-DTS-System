import {describe,it,expect} from 'vitest';
import type {Entity} from '../../packages/contracts';
import {expenseInput} from '../../packages/contracts';
import {PLANNING_SCHEMA_VERSION} from '../../packages/contracts/planning-module';
import {approvedAllowance,reconcileStoredExpenses,resolvedStatements,type ApprovedRevision} from '../../packages/domain/voucher-adapter';
import {computePerDiem} from '../../voucher/src/perDiem.js';
const org=crypto.randomUUID(),tripId=crypto.randomUUID(),itemId=crypto.randomUUID(),authId=crypto.randomUUID();
const entity=(kind:Entity['kind'],data:Record<string,unknown>,id=crypto.randomUUID()):Entity=>({id,organizationId:org,tripId,kind,version:1,status:'draft',updatedAt:'2026-09-25T00:00:00Z',data});
const revision:ApprovedRevision={id:crypto.randomUUID(),sha256:'a'.repeat(64),snapshot:{trip:entity('trip',{destination:'Washington, DC',departure:'2026-10-12',returnDate:'2026-10-15'},tripId),entity:entity('authorization',{formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:{traveler:'Synthetic Traveler',origin:'Boston, MA',currency:'USD',allowance:{enabled:true,governmentMess:false,mealsProvided:{}},approvedExpenseItems:[{id:itemId,category:'fuel',description:'Fuel',authorizedAmountMinor:10000}]}},authId)}};
const fuel=entity('expense',{tripId,merchant:'Test fuel',incurredOn:'2026-10-12',amountMinor:10000,currency:'USD',category:'fuel',authorizationItemId:itemId,paymentMethod:'gtcc',documentIds:[]});
describe('connected companion',()=>{
 it('binds a lost receipt statement to the exact expense version',()=>{
  const key=`${fuel.id}:receipt_missing`;const resolution={type:'lost_receipt_statement' as const,value:{reason:'Receipt was lost during the trip.',expenseVersion:1}};
  expect(reconcileStoredExpenses(revision,[fuel],[],{[key]:resolution}).ready).toBe(true);
  expect(resolvedStatements(revision,[fuel],{[key]:resolution})[key].value).toMatchObject({vendor:'Test fuel',amount:100,date:'2026-10-12',traveler:'Synthetic Traveler'});
  expect(reconcileStoredExpenses(revision,[{...fuel,version:2}],[],{[key]:resolution}).ready).toBe(false);
  expect(reconcileStoredExpenses(revision,[{...fuel,data:{...fuel.data,bookedOnline:true}}],[],{[key]:resolution}).ready).toBe(false);
 });
 it('rejects invalid lodging splits and incomplete stay dates at the command boundary',()=>{
  const data={...fuel.data,category:'lodging',taxesMinor:11000};expect(expenseInput.safeParse(data).success).toBe(false);
  expect(expenseInput.safeParse({...data,taxesMinor:1000,serviceStartDate:'2026-10-12'}).success).toBe(false);
  expect(expenseInput.safeParse({...data,taxesMinor:1000,serviceStartDate:'2026-10-12',serviceEndDate:'2026-10-15'}).success).toBe(true);
 });
 it('uses the frozen allowance after submission',()=>{
  const value=approvedAllowance(revision)!;expect(value.supported).toBe(true);
  const frozen={...revision,snapshot:{...revision.snapshot,perDiem:value,trip:{...revision.snapshot.trip,data:{...revision.snapshot.trip.data,destination:'Tokyo, JP'}}}};
  expect(approvedAllowance(frozen)).toEqual(value);
 });
 it('bounds malformed or unreasonably long rate requests',()=>{
  for(const startDate of ['2026-99-99','not a date','0001-01-01'])expect(computePerDiem({startDate,endDate:'2026-10-15',destination:'Washington, DC'}).supported).toBe(false);
 });
});
