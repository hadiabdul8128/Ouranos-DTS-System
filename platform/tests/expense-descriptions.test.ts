import {describe,expect,it} from 'vitest';
import {descriptionOptions,isListedDescription} from '../../packages/domain/expense-descriptions';
import {travelCategories} from '../../packages/contracts/planning-module';

describe('expense descriptions',()=>{
 it('offers choices for every planned expense type',()=>{for(const category of travelCategories)expect(descriptionOptions(category).length).toBeGreaterThan(1)});
 it('falls back to general choices and treats typed text as Other',()=>{
  expect(descriptionOptions('unknown')).toEqual(descriptionOptions('other'));
  expect(isListedDescription('lodging','Hotel')).toBe(true);
  expect(isListedDescription('airfare','Hotel')).toBe(false);
  expect(isListedDescription('ground_transport','Mileage, own car · 420 miles round trip')).toBe(false);
 });
});
