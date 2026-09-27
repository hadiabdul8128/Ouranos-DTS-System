import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parseHotelCatalog} from '../../packages/domain/hotel-discovery';
import {findNearbyHotels,milesBetween,postalCentersSchema} from '../../packages/domain/hotel-nearby';

const catalog=parseHotelCatalog(JSON.parse(readFileSync(new URL('../../public/lodging/fedrooms-2026.json',import.meta.url),'utf8')));
const centers=postalCentersSchema.parse(JSON.parse(readFileSync(new URL('../../public/lodging/us-postal-centroids.json',import.meta.url),'utf8')));

describe('standalone nearby hotel search',()=>{
 it('validates a sourced US ZIP catalog',()=>{
  expect(Object.keys(centers.points).length).toBeGreaterThan(40_000);
  expect(Object.keys(centers.cities).length).toBeGreaterThan(10_000);
  expect(centers.license).toBe('CC BY 4.0');
  expect(()=>postalCentersSchema.parse({...centers,points:{'92101':[500,0]}})).toThrow();
 });
 it('finds nearby properties without a trip',()=>{
  const result=findNearbyHotels(catalog,centers,'92101',{radiusMiles:5});
  expect(result.status).toBe('found');
  expect(result.radiusApplied).toBe(true);
  expect(result.total).toBeGreaterThan(10);
  expect(result.hotels[0].distanceMiles).toBeLessThanOrEqual(result.hotels.at(-1)!.distanceMiles!);
  expect(result.hotels.every(entry=>entry.distanceMiles!<=5)).toBe(true);
 });
 it('uses a work ZIP as the search center when a city is entered',()=>{
  const result=findNearbyHotels(catalog,centers,'San Diego, CA',{workZip:'92101',radiusMiles:5});
  expect(result.status).toBe('found');
  expect(result.location).toBe('work ZIP 92101');
  expect(result.center).toEqual(centers.points['92101']);
 });
 it('can center a search on a US town with no FedRooms listing of its own',()=>{
  const result=findNearbyHotels(catalog,centers,'Boring, OR',{radiusMiles:25});
  expect(result.status).toBe('found');
  expect(result.location).toBe('Boring, Oregon');
  expect(result.center).toEqual(centers.cities['boring|or'].slice(0,2));
 });
 it('requires a choice for an ambiguous city',()=>{
  const result=findNearbyHotels(catalog,centers,'Portland');
  expect(result.status).toBe('multiple_locations');
  expect(result.suggestions.some(choice=>choice.label==='Portland, Oregon')).toBe(true);
 });
 it('keeps hotel-name filters and does not invent ratings, photos, or rates',()=>{
  const result=findNearbyHotels(catalog,centers,'San Diego, CA',{hotelName:'Marriott',radiusMiles:10});
  expect(result.hotels.length).toBeGreaterThan(0);
  expect(result.hotels.every(entry=>entry.property[0].toLowerCase().includes('marriott'))).toBe(true);
  expect(milesBetween(centers.points['92101'],centers.points['92101'])).toBe(0);
 });
});
