import type {Entity,EntityKind} from '../contracts';
import {APPROVAL_LEVEL_NAMES,approvalLevelsOf,currentApprovalLevel} from '../contracts/approval-chain';
import type {TeamLevel,TeamOverdue,TeamPerson,TeamTrip} from '../contracts/team';
import {historyTotals,tripHistory,type TripPayment} from './trip-history';
import {addDays} from './planner';

export type TeamPersonRow={member_id:string;email:string;level:TeamLevel;leader_id:string;role:string|null};
export type TeamRecordRow={kind:string;id:string;trip_id:string|null;traveler_id:string;status:string;data:Record<string,unknown>;updated_at:string|Date};

const day=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const levelOf=(label:string):TeamLevel|null=>label===APPROVAL_LEVEL_NAMES[0]?'s1':label===APPROVAL_LEVEL_NAMES[1]?'command':null;

/** One entry per person the leader added, with their trips, overdue items, money and checklists. */
export function buildTeamPeople(people:TeamPersonRow[],records:TeamRecordRow[],leaderId:string,today:string):TeamPerson[]{
 const byMember=new Map<string,TeamPersonRow[]>();
 for(const row of people){byMember.set(row.member_id,[...(byMember.get(row.member_id)??[]),row])}
 return [...byMember.entries()].map(([memberId,rows])=>{
  const mine=records.filter(r=>r.traveler_id===memberId);
  const levels=rows.filter(r=>r.leader_id===leaderId).map(r=>r.level);
  const entities:Entity[]=mine.filter(r=>['trip','authorization','expense','voucher'].includes(r.kind)).map(r=>({id:r.id,organizationId:'',...(r.trip_id?{tripId:r.trip_id}:{}),kind:r.kind as EntityKind,version:1,status:r.status,data:r.data,updatedAt:new Date(r.updated_at).toISOString()}));
  const payments:Record<string,TripPayment>={};
  for(const r of mine)if(r.kind==='payment'&&r.trip_id)payments[r.trip_id]={amountMinor:Number(r.data.amountMinor),date:String(r.data.date).slice(0,10)};
  const history=tripHistory(entities,payments,today);
  const approvals=mine.filter(r=>r.kind==='approval');
  const trips:TeamTrip[]=history.map(trip=>{
   const plan=entities.filter(e=>e.kind==='authorization'&&e.tripId===trip.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
   const request=plan?approvals.filter(a=>a.data.entityId===plan.id).sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime())[0]:undefined;
   const current=request?currentApprovalLevel(approvalLevelsOf({status:request.status,data:request.data})):null;
   const currentLevel=current?levelOf(current.label):null;
   return {id:trip.id,destination:trip.destination,departure:trip.departure,returnDate:trip.returnDate,purpose:trip.purpose,phase:trip.phase,planStatus:trip.planStatus,voucherStatus:trip.voucherStatus,payStatus:trip.payStatus,plannedMinor:trip.plannedMinor,claimedMinor:trip.claimedMinor,paidMinor:trip.payment?.amountMinor??null,
    approval:request?{status:request.status,current:request.status==='in_review'?current?.label??null:null,waitingOnYou:request.status==='in_review'&&currentLevel!==null&&levels.includes(currentLevel)}:null};
  });
  const checklists=mine.filter(r=>r.kind==='assignment').map(r=>({id:r.id,title:String(r.data.title),done:Number(r.data.doneCount),total:Number(r.data.stepCount),dueOn:typeof r.data.dueOn==='string'?r.data.dueOn:null}));
  const overdue:TeamOverdue[]=[
   ...history.filter(t=>t.payStatus==='not_filed').map(t=>({kind:'voucher_not_filed' as const,label:`Voucher not filed · ${t.destination}`,tripId:t.id})),
   ...history.filter(t=>t.phase!=='past'&&(!t.planStatus||['draft','changes_requested'].includes(t.planStatus))&&t.departure<=addDays(today,7)).map(t=>({kind:'plan_draft' as const,label:`Plan not sent · ${t.destination} leaves ${day(t.departure)}`,tripId:t.id})),
   ...checklists.filter(c=>c.dueOn&&c.dueOn<today&&c.done<c.total).map(c=>({kind:'checklist_late' as const,label:`Checklist late · ${c.title}`,checklistId:c.id})),
  ];
  const t=historyTotals(history);
  return {memberId,email:rows[0]!.email,role:rows[0]!.role,levels,trips,totals:{trips:t.trips,plannedMinor:t.plannedMinor,claimedMinor:t.claimedMinor,paidMinor:t.paidMinor,awaitingMinor:t.awaitingMinor},overdue,waitingOnYou:trips.filter(x=>x.approval?.waitingOnYou).length,checklists};
 }).sort((a,b)=>b.waitingOnYou-a.waitingOnYou||b.overdue.length-a.overdue.length||a.email.localeCompare(b.email));
}
