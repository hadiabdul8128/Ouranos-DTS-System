import {describe,it,expect} from 'vitest';
import {approvalTrackingSteps} from '../../components/travel/approval-tracking-steps';
const levels=[{position:0,label:'S1 · Administration',role:'reviewer',status:'approved',decidedAt:'2026-10-06T12:00:00Z'},{position:1,label:'Command approval',role:'approver',status:'pending'}];
describe('approval tracking milestones',()=>{
 it('uses the prior decision as the time the next reviewer received the request',()=>{
  const steps=approvalTrackingSteps({status:'in_review',data:{submittedAt:'2026-10-05T12:00:00Z',levels}});
  expect(steps.map(s=>s.isCompleted)).toEqual([true,true,false]);
  expect(steps[2].name).toBe('Command approval · In review');
  expect(steps[2].timestamp).toContain('Received');
  expect(steps[2].timestamp).toContain('Oct 6');
 });
 it('does not mark returned or rejected decisions complete',()=>{
  for(const status of ['changes_requested','rejected']){
   const steps=approvalTrackingSteps({status,data:{levels:[{...levels[0],status},{...levels[1]}]}});
   expect(steps.map(s=>s.isCompleted)).toEqual([true,false,false]);
   expect(steps[1].name).toContain(status==='rejected'?'Not approved':'Changes requested');
   expect(steps[2].name).toContain('Pending');
  }
 });
 it('does not manufacture missing or invalid dates',()=>{
  const steps=approvalTrackingSteps({status:'approved',data:{submittedAt:'invalid'}});
  expect(steps[0].timestamp).toBe('Submission date unavailable');
  expect(steps[1].timestamp).toBe('Decision date unavailable');
  expect(steps[1].isCompleted).toBe(true);
 });
});
