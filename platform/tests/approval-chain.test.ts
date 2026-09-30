import {describe,expect,it} from 'vitest';
import {approvalLevelsOf,approvalUpdateNotice,approvalUpdateSummary,currentApprovalLevel,decideApprovalLevel,initialApprovalLevels} from '../../packages/contracts/approval-chain';
import {formatPlace,parsePlace} from '../../packages/domain/place';

const ids={recipientId:crypto.randomUUID(),requestId:crypto.randomUUID(),tripId:crypto.randomUUID(),entityId:crypto.randomUUID()};
const decidedAt='2026-10-01T15:00:00.000Z';

describe('approval chain',()=>{
 it('names S1 and command levels and follows decisions',()=>{
  const levels=initialApprovalLevels([{role:'reviewer'},{role:'approver'}]);
  expect(levels.map(l=>l.label)).toEqual(['S1 · Administration','Command approval']);
  expect(currentApprovalLevel(levels)?.position).toBe(0);
  const afterS1=decideApprovalLevel(levels,0,'approved',decidedAt,'  ');
  expect(afterS1[0]).toEqual({position:0,label:'S1 · Administration',role:'reviewer',status:'approved',decidedAt});
  expect(currentApprovalLevel(afterS1)?.label).toBe('Command approval');
  expect(currentApprovalLevel(decideApprovalLevel(afterS1,1,'approved',decidedAt))).toBeNull();
 });
 it('keeps a configured label and reads requests saved before levels existed',()=>{
  expect(initialApprovalLevels([{role:'reviewer',label:'Battalion S1'}])[0]!.label).toBe('Battalion S1');
  expect(approvalLevelsOf({status:'changes_requested',data:{}})).toEqual([{position:0,label:'Review',role:'reviewer',status:'changes_requested'}]);
 });
 it('writes traveler updates for each outcome',()=>{
  const s1={position:0,label:'S1 · Administration'};
  const partial=approvalUpdateNotice({...ids,entityKind:'authorization',level:s1,decision:'approved',nextLevel:'Command approval',decidedAt});
  expect(partial).toMatchObject({title:'Approved by S1 · Administration',final:false});
  expect(approvalUpdateSummary(partial)).toBe('S1 · Administration approved it. Now with Command approval.');
  const final=approvalUpdateNotice({...ids,entityKind:'authorization',level:{position:1,label:'Command approval'},decision:'approved',decidedAt});
  expect(final).toMatchObject({title:'Authorization approved',final:true});
  const returned=approvalUpdateNotice({...ids,entityKind:'authorization',level:s1,decision:'changes_requested',comment:' Add lodging receipts ',decidedAt});
  expect(returned).toMatchObject({title:'Changes requested by S1 · Administration',final:true,comment:'Add lodging receipts'});
  expect(approvalUpdateNotice({...ids,entityKind:'authorization',level:s1,decision:'rejected',decidedAt}).title).toBe('Authorization not approved by S1 · Administration');
 });
});

describe('city and state places',()=>{
 it('round-trips U.S. and overseas places',()=>{
  expect(parsePlace('San Antonio, TX')).toEqual({city:'San Antonio',region:'TX',country:''});
  expect(parsePlace('New York, New York')).toEqual({city:'New York',region:'NY',country:''});
  expect(parsePlace('Ramstein, Germany')).toEqual({city:'Ramstein',region:'overseas',country:'Germany'});
  expect(parsePlace('Fort Bragg')).toEqual({city:'Fort Bragg',region:'',country:''});
  expect(formatPlace(' Fayetteville ','NC','')).toBe('Fayetteville, NC');
  expect(formatPlace('Ramstein','overseas','Germany')).toBe('Ramstein, Germany');
  expect(formatPlace('Fayetteville','','')).toBe('');
 });
});
