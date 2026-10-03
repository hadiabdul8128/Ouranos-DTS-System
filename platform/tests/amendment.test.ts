import {describe,expect,it} from 'vitest';
import {amendmentChanges} from '../../packages/domain/amendment';

const flight={id:'00000000-0000-4000-8000-000000000001',category:'airfare' as const,description:'Round-trip flight',authorizedAmountMinor:43000};
const hotel={id:'00000000-0000-4000-8000-000000000002',category:'lodging' as const,description:'Hotel',authorizedAmountMinor:56400};
const approved={destination:'Denver, CO',departure:'2026-11-05',returnDate:'2026-11-08',purpose:'Training',items:[flight,hotel]};
describe('amendment changes',()=>{
 it('lists only what changed, with before and after',()=>{
  const changes=amendmentChanges(approved,{...approved,returnDate:'2026-11-10',items:[{...hotel,authorizedAmountMinor:75200},{id:'00000000-0000-4000-8000-000000000003',category:'rental_car',description:'Rental car',authorizedAmountMinor:20000}]});
  expect(changes).toEqual([
   {label:'Return',from:'Nov 8, 2026',to:'Nov 10, 2026'},
   {label:'Hotel',from:'$564.00',to:'$752.00'},
   {label:'Added · Rental car',from:'—',to:'$200.00'},
   {label:'Removed · Round-trip flight',from:'$430.00',to:'—'},
   {label:'Total',from:'$994.00',to:'$952.00'},
  ]);
 });
 it('says nothing when the plan is the same',()=>expect(amendmentChanges(approved,approved)).toEqual([]));
});
