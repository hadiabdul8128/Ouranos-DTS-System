import type {Entity} from '@/packages/contracts';
import {approvalLevelsOf,currentApprovalLevel,waitingSince} from '../../packages/contracts/approval-chain';
import type {OrderTrackingProps} from '@/components/ui/order-tracking';

const date=(value:unknown)=>{
 if(typeof value!=='string'||!value)return null;
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?null:parsed.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'});
};

/** Use recorded decisions only; a pending or returned level is never shown as completed. */
export function approvalTrackingSteps(request:Pick<Entity,'status'|'data'>&{updatedAt?:string}):OrderTrackingProps['steps']{
 const levels=approvalLevelsOf(request),current=currentApprovalLevel(levels);
 return [{name:'Submitted',timestamp:date(request.data.submittedAt)??'Submission date unavailable',isCompleted:true},...levels.map(level=>{
  const isCurrent=level.position===current?.position;
  const state=level.status==='approved'?'Approved':level.status==='changes_requested'?'Changes requested':level.status==='rejected'?'Not approved':isCurrent&&request.status==='in_review'?'In review':'Pending';
  const decisionDate=date(level.decidedAt);
  return {name:`${level.label} · ${state}`,timestamp:decisionDate??(level.status!=='pending'?'Decision date unavailable':isCurrent&&request.status==='in_review'?`Received ${date(waitingSince(request))??'date unavailable'}`:'Pending'),isCompleted:level.status==='approved'};
 })];
}
