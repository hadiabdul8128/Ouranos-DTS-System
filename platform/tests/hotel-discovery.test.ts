import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHotelCatalog,searchHotels,canonicalLocation,hotelAddress,hotelMapUrl} from '../../packages/domain/hotel-discovery';

const catalog=parseHotelCatalog(JSON.parse(readFileSync(new URL('../../public/lodging/fedrooms-2026.json',import.meta.url),'utf8')));

describe('sourced hotel discovery',()=>{
 it('retains the source date and thousands of real GSA records',()=>{
  expect(catalog.source).toBe('https://www.gsa.gov/system/files/2026_08-31-2026%20FedRooms%20Accepted%20Properties.xlsx');
  expect(catalog.published).toBe('2026-08-31');
  expect(catalog.properties.length).toBeGreaterThan(12_000);
 });
 it('uses a trip destination to find hotels without claiming live inventory',()=>{
  const result=searchHotels(catalog,'San Diego, CA');
  expect(result.status).toBe('found');
  expect(result.total).toBeGreaterThan(50);
  expect(result.properties.every(p=>p[2]==='San Diego'&&p[3]==='California')).toBe(true);
 });
 it('requires a location choice when a city name appears in multiple states',()=>{
  const result=searchHotels(catalog,'Portland');
  expect(result.status).toBe('multiple_locations');
  expect(result.suggestions.some(s=>s.label==='Portland, Oregon')).toBe(true);
  expect(result.suggestions.some(s=>s.label==='Portland, Maine')).toBe(true);
  expect(result.properties).toEqual([]);
 });
 it('accepts postal codes and ranks a chosen work ZIP within the destination',()=>{
  const exact=searchHotels(catalog,'92101');
  expect(exact.status).toBe('found');
  expect(exact.properties.every(p=>p[4].startsWith('92101'))).toBe(true);
  const city=searchHotels(catalog,'San Diego, California',{workZip:'92101',limit:100});
  expect(city.properties[0][4].startsWith('92101')).toBe(true);
 });
 it('filters the selected city without silently searching another city',()=>{
  const result=searchHotels(catalog,'San Diego, CA',{hotelName:'Marriott'});
  expect(result.status).toBe('found');
  expect(result.properties.every(p=>p[0].toLowerCase().includes('marriott'))).toBe(true);
  expect(searchHotels(catalog,'Fort Bragg, NC').status).toBe('not_found');
 });
 it('supports an overseas city and encodes a public-address map link',()=>{
  const result=searchHotels(catalog,'London, UK');
  expect(result.status).toBe('found');
  expect(result.properties.every(p=>p[5]==='United Kingdom')).toBe(true);
  expect(canonicalLocation(result.properties[0])).toBe('London, United Kingdom');
  expect(hotelMapUrl(result.properties[0])).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
 });
 it('does not route an overseas property using a malformed state in the source file',()=>{
  const perth=catalog.properties.find(p=>p[0]==='The Westin Perth');
  expect(perth).toBeDefined();
  expect(hotelAddress(perth!)).not.toContain('Washington');
  expect(decodeURIComponent(hotelMapUrl(perth!))).not.toContain('Washington');
 });
 it('rejects altered or malformed catalog data',()=>{
  expect(()=>parseHotelCatalog({...catalog,source:'javascript:alert(1)'})).toThrow();
  expect(()=>parseHotelCatalog({...catalog,properties:[['Hotel','Address','City']]})).toThrow();
 });
});
