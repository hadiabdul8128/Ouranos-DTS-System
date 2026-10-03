'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Check} from 'lucide-react';
import type {Entity} from '@/packages/contracts';
import {approvalLevelsOf,currentApprovalLevel} from '@/packages/contracts/approval-chain';
import {localToday} from '@/packages/domain/flight-search';
import {tripProgress} from '@/packages/domain/trip-progress';
import type {LocalRecord} from '@/packages/offline/database';
import {usePayments} from './use-payments';
import './trip-timeline.css';

type Page='planning'|'vouchers';
const latest=(rows:LocalRecord[],kind:string,tripId:string)=>rows.filter(r=>r.kind===kind&&r.local.tripId===tripId).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0];
const text=(value:unknown)=>typeof value==='string'?value:'';

/** Four document stages for the trip and the one thing to do next, at the top of every trip page. */
/** The trip's steps and next step from the saved records; shared by the trip pages and the Travel list. */
export function progressFor(trip:Entity,rows:LocalRecord[],paid:boolean,today:string){
 const plan=latest(rows,'authorization',trip.id),voucher=latest(rows,'voucher',trip.id);
 const planStatus=plan?(plan.server?.status||plan.local.status):undefined;
 const request=plan?rows.filter(r=>r.kind==='approval'&&r.local.data.entityId===plan.id&&r.local.status==='in_review').sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0]:undefined;
 const waitingOn=request?currentApprovalLevel(approvalLevelsOf(request.local))?.label:undefined;
 return tripProgress({planStatus,changing:Boolean((plan?.local.data.formData as {amendment?:unknown}|undefined)?.amendment),waitingOn,departure:text(trip.data.departure),returnDate:text(trip.data.returnDate),today,voucherStatus:voucher?(voucher.server?.status||voucher.local.status):undefined,paid});
}
export const tripHref=(tripId:string)=>({plan:`/dashboard/travel/planning?tripId=${tripId}`,expenses:`/dashboard/travel/vouchers?tripId=${tripId}`,hotels:`/dashboard/travel/hotels?tripId=${tripId}`});

export function TripTimeline({trip,rows,page}:{trip:Entity;rows:LocalRecord[];page:Page}){
 const [today]=useState(localToday),{payments}=usePayments();
 const {steps,next}=progressFor(trip,rows,Boolean(payments[trip.id]),today);
 const href=tripHref(trip.id);
 const pageOf={plan:'planning',expenses:'vouchers',hotels:''} as const;
 const stepLink=(id:string)=>id==='plan'||id==='approval'?href.plan:id==='expenses'||id==='paid'?(steps.find(step=>step.id==='approval')?.state==='done'?href.expenses:null):null;
 return <section className="trip-timeline" aria-label="Where this trip is">
  <ol>{steps.map(step=>{const link=stepLink(step.id),inner=<><span className="trip-timeline-dot" aria-hidden="true">{step.state==='done'&&<Check size={12}/>}</span><span>{step.label}</span></>;return <li key={step.id} className={`is-${step.state}`} aria-current={step.state==='current'?'step':undefined}>{link?<Link href={link}>{inner}</Link>:<span className="trip-timeline-step">{inner}</span>}</li>})}</ol>
  <div className="trip-timeline-next">
   <div><span>Next</span><strong>{next.title}</strong><p>{next.detail}</p></div>
   {next.action&&pageOf[next.action.to]!==page&&<Link className="trip-timeline-action" href={href[next.action.to]}>{next.action.label} <ArrowRight size={16}/></Link>}
  </div>
 </section>;
}
