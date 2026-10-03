import {describe,expect,it} from 'vitest';
import {splitTerms} from '../../packages/domain/glossary';

describe('glossary',()=>{
 it('marks whole-word terms once, including M&IE',()=>{
  expect(splitTerms('Ask for an AEA. The AEA needs M&IE rates.')).toEqual(['Ask for an ',{term:'AEA'},'. The AEA needs ',{term:'M&IE'},' rates.']);
 });
 it('leaves words that only contain a term alone',()=>{
  expect(splitTerms('GSAX and AEAs and LOAD')).toEqual(['GSAX and AEAs and LOAD']);
  expect(splitTerms('Use a GSA fare')).toEqual(['Use a ',{term:'GSA'},' fare']);
 });
});
