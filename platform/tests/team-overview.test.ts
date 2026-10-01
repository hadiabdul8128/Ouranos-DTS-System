import {describe,expect,it} from 'vitest';
import {buildTeamPeople,type TeamRecordRow} from '../../packages/domain/team-overview';

const today='2026-10-01',leader='L',member='M';
const row=(kind:string,id:string,trip:string|null,status:string,data:Record<string,unknown>):TeamRecordRow=>({kind,id,trip_id:trip,traveler_id:member,status,data,updated_at:'2026-09-30T00:00:00Z'});
describe('team overview',()=>{
 it('flags requests at the leader’s level and plans about to leave unsent',()=>{
  const people=buildTeamPeople([{member_id:member,email:'m@unit.mil',level:'command',leader_id:leader,role:'traveler'}],[
   row('trip','t1',null,'draft',{destination:'Denver, CO',departure:'2026-10-05',returnDate:'2026-10-07',purpose:'Training'}),
   row('trip','t2',null,'draft',{destination:'Reno, NV',departure:'2026-10-20',returnDate:'2026-10-22',purpose:'Meeting'}),
   row('authorization','a2','t2','in_review',{formData:{approvedExpenseItems:[{category:'lodging',authorizedAmountMinor:20000}]}}),
   row('approval','r2','t2','in_review',{entityId:'a2',levels:[{position:0,label:'S1 · Administration',role:'reviewer',status:'approved'},{position:1,label:'Command approval',role:'approver',status:'pending'}]}),
  ],leader,today);
  expect(people[0]).toMatchObject({levels:['command'],waitingOnYou:1,overdue:[{kind:'plan_draft',tripId:'t1'}]});
  expect(people[0]!.trips.find(t=>t.id==='t2')!.approval).toEqual({status:'in_review',current:'Command approval',waitingOnYou:true});
  expect(people[0]!.totals.plannedMinor).toBe(20000);
 });
 it('flags a request that has waited at one level for more than 72 hours',()=>{
  const people=buildTeamPeople([{member_id:member,email:'m@unit.mil',level:'s1',leader_id:leader,role:'traveler'}],[
   row('trip','t3',null,'draft',{destination:'Boise, ID',departure:'2026-11-02',returnDate:'2026-11-04',purpose:'Training'}),
   row('authorization','a3','t3','in_review',{formData:{approvedExpenseItems:[]}}),
   row('approval','r3','t3','in_review',{entityId:'a3',submittedAt:'2026-09-27T09:00:00Z',levels:[{position:0,label:'S1 · Administration',role:'reviewer',status:'pending'}]}),
  ],leader,today);
  expect(people[0]!.overdue).toEqual([{kind:'approval_late',label:'Approval waiting 4 days · Boise, ID',tripId:'t3'}]);
 });
});
