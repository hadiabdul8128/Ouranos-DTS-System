import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {distanceKm,findPlace,parseRentalCatalog,rentalMapUrl,searchRentalCounters} from '../../packages/domain/rental-car';

const catalog=parseRentalCatalog(JSON.parse(readFileSync(new URL('../../public/travel/rental-cars-2026.json',import.meta.url),'utf8')));

describe('rental car finder',()=>{
 it('ships thousands of real counters from the major rental companies',()=>{
  expect(catalog.counters.length).toBeGreaterThan(5_000);
  expect(new Set(catalog.counters.map(c=>c[0]))).toEqual(new Set(['Alamo','Avis','Enterprise','Hertz','National']));
 });
 it('leaves out counters a traveler cannot walk into',()=>{
  expect(catalog.counters.some(c=>/\b(only|exotics?|trucks?)\b/i.test(`${c[1]} ${c[2]}`))).toBe(false);
 });
 it('finds the trip destination, including spelled-out or abbreviated saints and forts',()=>{
  expect(findPlace(catalog,'Seattle, WA')?.name).toBe('Seattle, WA');
  expect(findPlace(catalog,'Saint Louis, MO')?.name).toBe('St. Louis, MO');
  expect(findPlace(catalog,'Ft Worth, TX')?.name).toBe('Fort Worth, TX');
  expect(findPlace(catalog,'Seattle')).toBeNull();
 });
 it('lists the counters nearest the destination first, with airport counters marked',()=>{
  const result=searchRentalCounters(catalog,'San Diego, CA');
  expect(result.status).toBe('found');
  if(result.status!=='found')return;
  expect(result.locations.length).toBeGreaterThan(20);
  expect(result.locations.every((l,i,all)=>i===0||all[i-1]!.distanceKm<=l.distanceKm)).toBe(true);
  expect(result.locations.some(l=>l.airport&&/San Diego International/.test(l.branch))).toBe(true);
  expect(result.locations.every(l=>l.distanceKm<=80)).toBe(true);
 });
 it('says when a destination is unknown or has no counters nearby',()=>{
  expect(searchRentalCounters(catalog,'Nowhere Town, ZZ').status).toBe('no-place');
  expect(searchRentalCounters(catalog,'Seattle, WA',0).status).toBe('none-near');
 });
 it('measures distance in kilometres and links to the map',()=>{
  expect(distanceKm({lat:0,lon:0},{lat:0,lon:1})).toBeCloseTo(111.2,0);
  const location={id:'1',company:'Hertz',branch:'',address:'3202 Admiral Boland Way, San Diego, CA 92101',lat:32.73,lon:-117.19,distanceKm:1,airport:true,phone:'',website:''};
  expect(rentalMapUrl(location)).toContain(encodeURIComponent('Hertz, 3202 Admiral Boland Way'));
  expect(rentalMapUrl({...location,address:''})).toContain(encodeURIComponent('32.73,-117.19'));
 });
});
