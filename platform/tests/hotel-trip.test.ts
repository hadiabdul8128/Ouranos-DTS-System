import {describe,expect,it} from 'vitest';
import type {Entity} from '../../packages/contracts';
import type {LocalRecord} from '../../packages/offline/database';
import {hotelTripContext} from '../../packages/domain/hotel-trip';

const tripId='11111111-1111-4111-8111-111111111111';
const organizationId='22222222-2222-4222-8222-222222222222';
function record(kind:Entity['kind'],id:string,status:string,data:Record<string,unknown>,updatedAt='2026-09-01T00:00:00.000Z'):LocalRecord{
 const local:Entity={id,organizationId,kind,tripId:kind==='trip'?undefined:tripId,version:1,status,data,updatedAt};
 return {key:`${kind}:${id}`,kind,id,local};
}
const trip=record('trip',tripId,'draft',{destination:'San Diego, CA',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Training',timezone:'America/Los_Angeles'});
const plan=(status:string,amount:number,id:string,updatedAt?:string)=>record('authorization',id,status,{tripId,formSchemaVersion:'ouranos.planning.v1',formData:{traveler:'Alex Morgan',origin:'Raleigh, NC',currency:'USD',approvedExpenseItems:[{id:'33333333-3333-4333-8333-333333333333',category:'lodging',description:'Hotel',authorizedAmountMinor:amount},{id:'44444444-4444-4444-8444-444444444444',category:'airfare',description:'Flight',authorizedAmountMinor:62000}]}},updatedAt);

describe('hotel finder trip context',()=>{
 it('prefills saved destination and dates even before authorization exists',()=>{
  expect(hotelTripContext([trip],tripId)).toEqual({id:tripId,destination:'San Diego, CA',departure:'2026-10-12',returnDate:'2026-10-15',lodgingBudgetMinor:null,budgetLabel:null});
 });
 it('shows only lodging as a planned budget, not a hotel price',()=>{
  expect(hotelTripContext([trip,plan('draft',57000,'55555555-5555-4555-8555-555555555555')],tripId)?.lodgingBudgetMinor).toBe(57000);
  expect(hotelTripContext([trip,plan('draft',57000,'55555555-5555-4555-8555-555555555555')],tripId)?.budgetLabel).toBe('Planned lodging budget');
 });
 it('prefers the approved authorization over a newer draft revision',()=>{
  const approved=plan('approved',57000,'55555555-5555-4555-8555-555555555555');
  const draft=plan('draft',60000,'66666666-6666-4666-8666-666666666666','2026-09-02T00:00:00.000Z');
  expect(hotelTripContext([trip,draft,approved],tripId)).toMatchObject({lodgingBudgetMinor:57000,budgetLabel:'Approved lodging budget'});
 });
 it('rejects missing or malformed trips instead of displaying untrusted trip data',()=>{
  expect(hotelTripContext([trip],'77777777-7777-4777-8777-777777777777')).toBeNull();
  expect(hotelTripContext([{...trip,local:{...trip.local,data:{destination:'Nowhere'}}}],tripId)).toBeNull();
 });
});
