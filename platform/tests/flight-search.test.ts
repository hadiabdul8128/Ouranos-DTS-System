import {describe,expect,it} from 'vitest';
import {cheapestFlight,flightQuerySchema,flightSearchUrl,parseFlightOptions,searchFlights} from '../../packages/domain/flight-search';

const label=(text:string)=>`<li><div aria-label="${text}  Select flight"></div></li>`;
const html=[
 label('From 864 US dollars round trip total. 1 stop flight with Delta. Operated by Endeavor Air DBA Delta Connection. Leaves Fayetteville Regional Airport (FAY) at 6:00 AM on Thursday, November 12 and arrives at Daniel K. Inouye International Airport at 2:40 PM on Thursday, November 12. Total duration 13 hr 40 min.  Layover (1 of 1) is a 2 hr 5 min layover at Hartsfield-Jackson Atlanta International Airport in Atlanta.'),
 label('From 1,188 US dollars round trip total. 2 stops flight with Delta and Alaska. Leaves Fayetteville Regional Airport (FAY) at 6:00 AM on Thursday, November 12 and arrives at Daniel K. Inouye International Airport at 5:10 PM on Thursday, November 12. Total duration 16 hr 10 min.'),
 label('From 790 US dollars round trip total. Nonstop flight with Hawaiian &amp; Friends. Leaves Fayetteville Regional Airport (FAY) at 9:00 AM on Thursday, November 12 and arrives at Daniel K. Inouye International Airport at 3:00 PM on Thursday, November 12. Total duration 11 hr.'),
 label('From 864 US dollars round trip total. 1 stop flight with Delta. Leaves Fayetteville Regional Airport (FAY) at 6:00 AM on Thursday, November 12 and arrives at Daniel K. Inouye International Airport at 2:40 PM on Thursday, November 12. Total duration 13 hr 40 min.'),
 '<div aria-label="From an unrelated widget. Select flight"></div>',
].join('');

describe('flight search',()=>{
 it('parses Google Flights results in page order and removes duplicates',()=>{
  const options=parseFlightOptions(html);
  expect(options.map(o=>o.price)).toEqual([864,1188,790]);
  expect(options[0]).toEqual({price:864,roundTrip:true,airline:'Delta',stops:1,departAirport:'Fayetteville Regional Airport (FAY)',departTime:'6:00 AM',arriveAirport:'Daniel K. Inouye International Airport',arriveTime:'2:40 PM',duration:'13 hr 40 min'});
  expect(options[1]).toMatchObject({airline:'Delta and Alaska',stops:2});
  expect(options[2]).toMatchObject({airline:'Hawaiian & Friends',stops:0,duration:'11 hr'});
  expect(cheapestFlight(options)?.price).toBe(790);
 });
 it('builds one-way and round-trip searches',()=>{
  expect(new URL(flightSearchUrl({from:'DCA',to:'San Antonio, TX',departure:'2026-11-12'})).searchParams.get('q')).toBe('Flights to San Antonio, TX from DCA on 2026-11-12 one way');
  expect(new URL(flightSearchUrl({from:'DCA',to:'SAT',departure:'2026-11-12',returnDate:'2026-11-16'})).searchParams.get('q')).toBe('Flights to SAT from DCA on 2026-11-12 through 2026-11-16');
 });
 it('rejects incomplete or reversed trips',()=>{
  expect(flightQuerySchema.safeParse({from:'DCA',to:'',departure:'2026-11-12'}).success).toBe(false);
  expect(flightQuerySchema.safeParse({from:'DCA',to:'SAT',departure:'2026-11-12',returnDate:'2026-11-10'}).success).toBe(false);
 });
 it('reports an unavailable search instead of returning no flights',async()=>{
  await expect(searchFlights({from:'DCA',to:'SAT',departure:'2026-11-12'},async()=>new Response('',{status:429}))).rejects.toThrow('unavailable');
  const result=await searchFlights({from:'DCA',to:'SAT',departure:'2026-11-12'},async()=>new Response(html));
  expect(result.options).toHaveLength(3);
 });
});
