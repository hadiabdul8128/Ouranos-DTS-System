import {describe,expect,it} from 'vitest';
import {aeaJustificationDraft,hotelAtRate,lodgingOverage} from '../../packages/domain/lodging-aea';
import {planningModuleSchema} from '../../packages/contracts/planning-module';

const trip={destination:'Seattle, WA',departure:'2026-12-05',returnDate:'2026-12-08'};
const hotel=(authorizedAmountMinor:number,extra={})=>({category:'lodging' as const,description:'Hotel',authorizedAmountMinor,...extra});
describe('lodging over per diem',()=>{
 it('compares room cost with the per diem cap for the same nights, leaving taxes out',()=>{
  const o=lodgingOverage(trip,[hotel(120000),{category:'lodging',description:'Lodging Tax',authorizedAmountMinor:20000}]);
  expect(o).toMatchObject({nights:3,allowedNightlyMinor:18800,actualNightlyMinor:40000,differenceMinor:63600,percent:213,overMax:false,locality:'Seattle, WA',match:'city'});
  const yakima=lodgingOverage({...trip,destination:'Yakima, WA'},[hotel(60000)])!;
  expect(yakima).toMatchObject({match:'standard',allowedNightlyMinor:11300});
  expect(aeaJustificationDraft(yakima)).toContain('lodging in Yakima, WA.');
 });
 it('flags anything past 300% and uses the stay dates when given',()=>{
  expect(lodgingOverage(trip,[hotel(80000,{startDate:'2026-12-05',endDate:'2026-12-06'})])).toMatchObject({nights:1,percent:426,overMax:true});
 });
 it('says nothing when within the cap or when rates are unknown',()=>{
  expect(lodgingOverage(trip,[hotel(30000)])).toBeNull();
  expect(lodgingOverage({...trip,destination:'Paris, France'},[hotel(300000)])).toBeNull();
  expect(lodgingOverage(trip,[{category:'airfare',description:'Round-trip flight',authorizedAmountMinor:900000}])).toBeNull();
 });
 it('drafts the justification items AFMAN 65-114 asks for',()=>{
  const draft=aeaJustificationDraft(lodgingOverage(trip,[hotel(120000)])!);
  for(const line of ['Allowed nightly lodging rate: $188.00','Actual nightly lodging rate: $400.00','Difference for the trip: $636.00','AEA percentage: 213%','Efforts to find lodging'])expect(draft).toContain(line);
 });
 it('saves the justification with the plan',()=>{
  const plan={traveler:'A',origin:'Austin, TX',currency:'USD' as const,approvedExpenseItems:[{id:'00000000-0000-4000-8000-000000000001',...hotel(120000)}]};
  expect(planningModuleSchema.parse({...plan,aeaJustification:' Conference week '}).aeaJustification).toBe('Conference week');
  expect(planningModuleSchema.safeParse({...plan,aeaJustification:''}).success).toBe(false);
 });
 it('prices a hotel at the lodging rate for every night',()=>{
  expect(hotelAtRate(trip)).toEqual({nights:3,totalMinor:56400,nightlyMinor:18800});
  expect(hotelAtRate({...trip,destination:'Paris, France'})).toBeNull();
  expect(hotelAtRate({...trip,returnDate:trip.departure})).toBeNull();
 });
});
