import {describe,expect,it} from 'vitest';
import {hasFlight,hasLodgingTax,hasTmcFee,preAuditFlags,preAuditProblem,relevantPreAudit} from '../../packages/domain/pre-audit';
import {planningModuleSchema} from '../../packages/contracts/planning-module';

const flight={category:'airfare',description:'Round-trip flight'},rental={category:'rental_car',description:'Rental Car - at TDY Area'};
describe('pre-audit flags',()=>{
 it('tells the TMC fee and lodging tax lines apart from the flight and the room',()=>{
  const fee={category:'airfare',description:'TMC Fee (IBA)'};
  expect(hasFlight([fee])).toBe(false);expect(hasTmcFee([flight,fee])).toBe(true);expect(hasTmcFee([flight])).toBe(false);
  expect(hasLodgingTax([{category:'lodging',description:'Hotel'}])).toBe(false);expect(hasLodgingTax([{category:'lodging',description:'Lodging Tax'}])).toBe(true);
 });
 it('blocks submitting a flagged choice until it has a reason',()=>{
  expect(preAuditProblem([flight],{flightFare:'other'})).toMatch(/GSA contract fare/);
  expect(preAuditProblem([flight],{flightFare:'other',flightReason:'Only flight that arrives before the report time'})).toBe('');
  expect(preAuditProblem([rental],{rentalClass:'larger',rentalReason:' '})).toMatch(/bigger than compact/);
  expect(preAuditProblem([rental],{rentalClass:'compact'})).toBe('');
  expect(preAuditProblem([],{flightFare:'other'})).toBe('');
 });
 it('keeps only answers that still apply and shows approvers the flags',()=>{
  expect(relevantPreAudit([rental],{flightFare:'other',flightReason:'x',rentalClass:'larger',rentalReason:' Five passengers '})).toEqual({rentalClass:'larger',rentalReason:'Five passengers'});
  expect(relevantPreAudit([flight],{flightFare:'gsa',flightReason:'old'})).toEqual({flightFare:'gsa'});
  expect(relevantPreAudit([],{flightFare:'gsa'})).toBeUndefined();
  expect(preAuditFlags({flightFare:'other',flightReason:'Arrival time',rentalClass:'compact'})).toEqual([{title:'Flight is not a GSA contract fare',reason:'Arrival time'}]);
 });
 it('saves the answers with the plan',()=>{
  const plan={traveler:'A',origin:'Austin, TX',currency:'USD' as const,approvedExpenseItems:[{id:'00000000-0000-4000-8000-000000000001',category:'airfare' as const,description:'Round-trip flight',authorizedAmountMinor:40000}]};
  expect(planningModuleSchema.safeParse({...plan,preAudit:{flightFare:'other',flightReason:'Arrival time'}}).success).toBe(true);
  expect(planningModuleSchema.safeParse({...plan,preAudit:{flightFare:'maybe'}}).success).toBe(false);
 });
});

describe('lodging and per diem warnings',()=>{
 it('spots Airbnb-type rentals in the merchant or description',async()=>{
  const {hasNonconventionalLodging,isNonconventionalLodging}=await import('../../packages/domain/pre-audit');
  expect(isNonconventionalLodging('Airbnb')).toBe(true);expect(isNonconventionalLodging('VRBO · Lake house')).toBe(true);expect(isNonconventionalLodging('Hilton Garden Inn')).toBe(false);
  expect(hasNonconventionalLodging([{category:'lodging',description:'Hotel',merchant:'Air BnB'}])).toBe(true);
  expect(hasNonconventionalLodging([{category:'other',description:'Airbnb cleaning'}])).toBe(false);
 });
 it('points out the DFAC rule for Annual Tour',async()=>{
  const {perDiemSituations}=await import('../../packages/domain/pre-audit');
  expect(perDiemSituations('Annual Tour (AT)')[0]).toMatchObject({id:'dfac',highlight:true});
  expect(perDiemSituations('Annual Tour (AT)')[0]!.detail).toMatch(/no per diem/);
  expect(perDiemSituations('Training').some(s=>s.highlight)).toBe(false);
 });
});
