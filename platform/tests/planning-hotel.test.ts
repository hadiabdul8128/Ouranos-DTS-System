import {describe,expect,it} from 'vitest';
import {hotelPlanTarget} from '../../packages/domain/planning-hotel';
import {searchHotels,type HotelCatalog,type HotelProperty} from '../../packages/domain/hotel-discovery';
const hotel:HotelProperty=['Example San Diego Hotel','1 Main St','San Diego','California','92101','United States'];
describe('planning hotel selection',()=>{
 it('prefills a spare lodging row without selecting airfare or overwriting another named hotel',()=>{
  const items=[{category:'airfare',merchant:''},{category:'lodging',merchant:'Other Hotel'},{category:'lodging',merchant:''}];
  expect(hotelPlanTarget(items,hotel)).toBe(2);
  expect(items[1].merchant).toBe('Other Hotel');
 });
 it('reuses the same chosen hotel even if an empty row comes first',()=>{
  expect(hotelPlanTarget([{category:'lodging',merchant:''},{category:'lodging',merchant:' example san diego hotel '}],hotel)).toBe(1);
 });
 it('requests a new lodging row when no compatible item exists',()=>{
  expect(hotelPlanTarget([{category:'airfare',merchant:''},{category:'lodging',merchant:'Another hotel'}],hotel)).toBe(-1);
 });
 it('uses the trip destination as the initial search and supports an optional ZIP filter',()=>{
  const catalog:HotelCatalog={source:'https://www.gsa.gov/travel/plan-a-trip/lodging/fedrooms',published:'2026-01-01',sha256:'a'.repeat(64),properties:[hotel]};
  expect(searchHotels(catalog,'San Diego, California').properties).toEqual([hotel]);
  expect(searchHotels(catalog,'92101').properties).toEqual([hotel]);
 });
});
