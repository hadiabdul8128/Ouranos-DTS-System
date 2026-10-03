import React,{useState} from 'react';
import {approvalLevelsOf,approvalWait,currentApprovalLevel} from '../../packages/contracts/approval-chain';
import type {Entity} from '../../packages/contracts';
import './approval-tracker.css';

const day=(value?:string)=>value?` · ${new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:'';

/** One line saying where a submitted request is now. */
export function ApprovalTracker({request}:{request:Pick<Entity,'status'|'data'>&{updatedAt?:string}}){
 const [now]=useState(()=>new Date()),wait=approvalWait(request,now);
 const levels=approvalLevelsOf(request),current=currentApprovalLevel(levels),last=levels[levels.length-1]!;
 const previous=current?levels.filter(level=>level.position<current.position&&level.status==='approved').at(-1):undefined;
 if(request.status==='approved')return <section className="approval-status is-done" role="status"><strong>Approved</strong><span>{last.label}{day(last.decidedAt)}</span></section>;
 if(!current)return null;
 if(request.status==='changes_requested'||request.status==='rejected')return <section className={`approval-status ${request.status==='rejected'?'is-rejected':'is-returned'}`} role="status">
  <strong>{request.status==='rejected'?'Not approved':'Changes requested'}</strong><span>{current.label}{day(current.decidedAt)}</span>
  {current.comment&&<blockquote>“{current.comment}”</blockquote>}
 </section>;
 return <section className={`approval-status is-active${wait?.late?' is-late':''}`} role="status">
  <strong>With {current.label}</strong>
  <span>{levels.length>1?`Step ${current.position+1} of ${levels.length}`:'Waiting for review'}{previous?` · ${previous.label} approved${day(previous.decidedAt)}`:''}</span>
  {levels.length>1&&<div className="approval-steps" aria-hidden="true">{levels.map(level=><i key={level.position} className={level.status==='approved'?'is-done':level.position===current.position?'is-current':''}/>)}</div>}
  {wait?.late&&<p className="approval-late">Waiting {wait.days} days. Approvers are asked to act within 72 hours, so check in with {current.label}.</p>}
 </section>;
}

/** A submission made before approvers were set. */
export function WaitingForApprovers(){
 return <section className="approval-status is-active" role="status"><strong>Submitted · waiting for approvers</strong><span>It goes to your S1 as soon as they add you to their team.</span></section>;
}
