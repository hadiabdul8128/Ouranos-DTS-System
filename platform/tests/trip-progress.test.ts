import {describe,expect,it} from 'vitest';
import {tripProgress} from '../../packages/domain/trip-progress';

const trip={departure:'2026-11-05',returnDate:'2026-11-08'};
const states=(p:ReturnType<typeof tripProgress>)=>p.steps.map(s=>s.state).join(' ');
describe('trip progress',()=>{
 it('starts at the plan',()=>{
  const p=tripProgress({...trip,today:'2026-10-01'});
  expect(states(p)).toBe('current todo todo todo todo');expect(p.next.action?.to).toBe('plan');
 });
 it('waits on the named approver while in review',()=>{
  const p=tripProgress({...trip,today:'2026-10-01',planStatus:'in_review',waitingOn:'S1 · Administration'});
  expect(states(p)).toBe('done current todo todo todo');expect(p.next).toMatchObject({title:'Waiting on S1 · Administration'});expect(p.next.action).toBeUndefined();
 });
 it('sends an approved trip to DTS, then to expenses once back',()=>{
  expect(tripProgress({...trip,today:'2026-10-01',planStatus:'approved'}).next.action?.to).toBe('dts');
  expect(tripProgress({...trip,today:'2026-11-06',planStatus:'approved'}).next.title).toBe('You’re traveling');
  const back=tripProgress({...trip,today:'2026-11-09',planStatus:'approved'});
  expect(states(back)).toBe('done done done current todo');expect(back.next.action?.to).toBe('expenses');
 });
 it('finishes with the voucher in DTS and payment',()=>{
  expect(tripProgress({...trip,today:'2026-11-20',planStatus:'approved',voucherStatus:'verified'}).next.action?.to).toBe('dts');
  const paid=tripProgress({...trip,today:'2026-12-01',planStatus:'approved',voucherStatus:'verified',paid:true});
  expect(states(paid)).toBe('done done done done done');expect(paid.next.title).toBe('All done');
  expect(states(tripProgress({...trip,today:'2026-12-01',planStatus:'approved',paid:true}))).toBe('done done done done done');
 });
 it('handles a plan sent back or being changed',()=>{
  expect(tripProgress({...trip,today:'2026-10-01',planStatus:'changes_requested'}).next.title).toBe('Fix what your approver asked');
  expect(tripProgress({...trip,today:'2026-10-01',planStatus:'draft',changing:true}).next.title).toBe('Finish your change');
 });
});
