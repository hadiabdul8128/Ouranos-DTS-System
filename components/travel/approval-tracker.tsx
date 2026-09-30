import React from 'react';
import {Check,CornerUpLeft,X} from 'lucide-react';
import {approvalLevelsOf,currentApprovalLevel,type ApprovalLevel} from '../../packages/contracts/approval-chain';
import type {Entity} from '../../packages/contracts';
import './approval-tracker.css';

const day=(value:string)=>new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric'});
function levelState(level:ApprovalLevel,current:ApprovalLevel|null,requestStatus:string){
 if(level.status==='approved')return {tone:'done',text:`Approved${level.decidedAt?` · ${day(level.decidedAt)}`:''}`};
 if(level.status==='changes_requested')return {tone:'returned',text:`Changes requested${level.decidedAt?` · ${day(level.decidedAt)}`:''}`};
 if(level.status==='rejected')return {tone:'rejected',text:`Not approved${level.decidedAt?` · ${day(level.decidedAt)}`:''}`};
 if(requestStatus==='in_review'&&current?.position===level.position)return {tone:'active',text:'Reviewing now'};
 return {tone:'waiting',text:requestStatus==='in_review'?'Waiting':'Not reached'};
}

/** Where a submitted request is in the chain of command. */
export function ApprovalTracker({request,submittedAt}:{request:Pick<Entity,'status'|'data'|'updatedAt'>;submittedAt?:string}){
 const levels=approvalLevelsOf(request),current=currentApprovalLevel(levels);
 const headline=request.status==='approved'?'Approved by the full chain':request.status==='changes_requested'?`Returned by ${current?.label??'a reviewer'}`:request.status==='rejected'?`Not approved by ${current?.label??'a reviewer'}`:`With ${current?.label??'reviewers'}`;
 return <section className="approval-tracker" aria-label="Chain of command">
  <div className="approval-tracker-head"><span>Chain of command</span><strong>{headline}</strong></div>
  <ol>
   <li className="is-done"><span className="approval-dot"><Check size={12}/></span><div><strong>Submitted</strong><small>{submittedAt?`Sent ${day(submittedAt)}`:'Sent for review'}</small></div></li>
   {levels.map(level=>{const state=levelState(level,current,request.status);return <li key={level.position} className={`is-${state.tone}`} aria-current={state.tone==='active'?'step':undefined}>
    <span className="approval-dot">{state.tone==='done'?<Check size={12}/>:state.tone==='returned'?<CornerUpLeft size={12}/>:state.tone==='rejected'?<X size={12}/>:level.position+1}</span>
    <div><strong><em>Level {level.position+1}</em>{level.label}</strong><small>{state.text}</small>{level.comment&&<blockquote>“{level.comment}”</blockquote>}</div>
   </li>})}
  </ol>
 </section>;
}
