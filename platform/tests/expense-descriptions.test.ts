import {describe,expect,it} from 'vitest';
import {descriptionOptions,dtsOptions,isListedDescription} from '../../packages/domain/expense-descriptions';
import {travelCategories} from '../../packages/contracts/planning-module';

describe('expense descriptions',()=>{
 it('offers choices for every planned expense type',()=>{for(const category of travelCategories)expect(descriptionOptions(category).length).toBeGreaterThan(1)});
 it('lists DTS expense type names first, using DTS spelling',()=>{
  expect(dtsOptions('parking')).toEqual(['Parking - At The Terminal','Parking - TDY Area']);
  expect(descriptionOptions('ground_transport')[0]).toBe('Private Auto - To/From TDY');
  expect(isListedDescription('lodging','Lodging Tax')).toBe(true);
 });
 it('falls back to general choices and treats typed text as Other',()=>{
  expect(descriptionOptions('unknown')).toEqual(descriptionOptions('other'));
  expect(isListedDescription('lodging','Hotel')).toBe(true);
  expect(isListedDescription('airfare','Hotel')).toBe(false);
  expect(isListedDescription('ground_transport','Private Auto - To/From TDY · 420 miles round trip')).toBe(false);
 });
});
