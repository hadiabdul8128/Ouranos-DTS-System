import {describe,expect,it} from 'vitest';
import {authorizationSheet,dtsExpenseType,voucherSheet} from '../../packages/domain/dts-sheet';

const id=(n:number)=>`00000000-0000-4000-8000-00000000000${n}`;
const trip={destination:'Tacoma, WA',installation:'Joint Base Lewis-McChord',departure:'2026-11-09',returnDate:'2026-11-13',purpose:'Annual Tour (AT)',ordersNumber:'AT-26-0412'};
const plan={traveler:'A',origin:'Austin, TX',currency:'USD' as const,approvedExpenseItems:[
 {id:id(1),category:'airfare' as const,description:'Round-trip flight',authorizedAmountMinor:43000},
 {id:id(2),category:'airfare' as const,description:'TMC Fee (IBA)',authorizedAmountMinor:2300},
 {id:id(3),category:'lodging' as const,description:'Hotel',authorizedAmountMinor:120000},
 {id:id(4),category:'lodging' as const,description:'Lodging Tax',authorizedAmountMinor:15600},
 {id:id(5),category:'parking' as const,description:'Parking - At The Terminal',authorizedAmountMinor:4800},
],preAudit:{flightFare:'other' as const,flightReason:'Arrives after report time'},aeaJustification:'Conference week'};
describe('DTS sheet',()=>{
 it('names expenses with DTS expense types',()=>{
  expect(dtsExpenseType('parking','Airport parking')).toBe('Parking - TDY Area');
  expect(dtsExpenseType('parking','Parking - At The Terminal')).toBe('Parking - At The Terminal');
  expect(dtsExpenseType('airfare','tmc fee')).toBe('TMC Fee (IBA)');
  expect(dtsExpenseType('other','Laundry')).toBeNull();
 });
 it('lays out the authorization in DTS order with values to copy',()=>{
  const sheet=authorizationSheet(trip,plan);
  expect(sheet.map(s=>s.id)).toEqual(['start','trip','reservations','perdiem','expenses','accounting','preaudit','submit']);
  expect(sheet[1]!.fields).toContainEqual({label:'TDY location',value:'Joint Base Lewis-McChord',copy:true});
  expect(sheet[1]!.fields[0]).toEqual({label:'Departure',value:'11/09/2026',copy:true});
  expect(sheet[4]!.fields).toEqual([{label:'TMC Fee (IBA)',value:'23.00',copy:true},{label:'Lodging Tax',value:'156.00',copy:true},{label:'Parking - At The Terminal',value:'48.00',copy:true}]);
  expect(sheet[6]!.fields.map(f=>f.label)).toEqual(['Why not the GSA fare','Hotel over the lodging rate (ACTUALS EXPENSE box)']);
  expect(sheet[7]!.fields).toEqual([{label:'Comment for your approver',value:'Orders AT-26-0412',copy:true}]);
 });
 it('lays out the voucher and keeps flights booked in DTS out of the expenses',()=>{
  const sheet=voucherSheet(trip,[{category:'airfare',description:'',merchant:'Delta',incurredOn:'2026-11-09',amountMinor:41250,paymentMethod:'gtcc'},{category:'parking',description:'',merchant:'SEA Airport',incurredOn:'2026-11-13',amountMinor:5200,paymentMethod:'personal'},{category:'lodging',description:'',merchant:'Hilton',incurredOn:'2026-11-13',amountMinor:98000}]);
  const expenses=sheet.find(s=>s.id==='v-expenses')!;
  expect(expenses.fields).toEqual([{label:'Parking - TDY Area · 11/13/2026 · Personal',value:'52.00',copy:true}]);
  expect(expenses.notes.some(n=>n.includes('already on the voucher'))).toBe(true);
  expect(sheet.find(s=>s.id==='v-lodging')!.fields[0]!.value).toBe('980.00');
 });
});
