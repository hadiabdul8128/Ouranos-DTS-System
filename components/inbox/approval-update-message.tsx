import React from 'react';
import Link from 'next/link';
import {ArrowUpRight,Check,CornerUpLeft,X} from 'lucide-react';
import {approvalUpdateSummary,type ApprovalUpdateNotice} from '../../packages/contracts/approval-chain';
import type {Entity} from '../../packages/contracts';
import {ApprovalTracker} from '../travel/approval-tracker';

export function ApprovalUpdateMessage({notice,request}:{notice:ApprovalUpdateNotice;request?:Entity}){
 const Icon=notice.decision==='approved'?Check:notice.decision==='changes_requested'?CornerUpLeft:X;
 const heading=notice.decision==='approved'?(notice.final?'Approved':`Level ${notice.level.position+1} approved`):notice.decision==='changes_requested'?'Changes requested':'Not approved';
 const planHref=`/dashboard/travel/${notice.entityKind==='voucher'?'vouchers':'planning'}?tripId=${notice.tripId}`;
 return <>
  <div className={`inbox-confirmation inbox-decision is-${notice.decision}`}><span className="inbox-check"><Icon size={19} aria-hidden="true"/></span><div><strong>{heading}</strong><p>{approvalUpdateSummary(notice)}</p></div></div>
  <dl className="inbox-trip-details">{notice.destination&&<div><dt>Destination</dt><dd>{notice.destination}</dd></div>}<div><dt>Decided by</dt><dd>Level {notice.level.position+1} · {notice.level.label}</dd></div><div><dt>Date</dt><dd>{new Date(notice.decidedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</dd></div>{notice.nextLevel&&<div><dt>Next</dt><dd>{notice.nextLevel}</dd></div>}{notice.comment&&<div className="inbox-wide"><dt>Comment</dt><dd>{notice.comment}</dd></div>}</dl>
  {request&&<ApprovalTracker request={request}/>}
  <Link className="inbox-open-plan" href={planHref}>{notice.decision==='changes_requested'?'Update your plan':notice.final&&notice.decision==='approved'&&notice.entityKind==='authorization'?'Open your plan':'View request'} <ArrowUpRight size={16} aria-hidden="true"/></Link>
 </>;
}
