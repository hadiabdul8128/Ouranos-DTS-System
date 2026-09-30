import React from 'react';
import Link from 'next/link';
import {ArrowUpRight,Check} from 'lucide-react';
import type {AuthorizationNotice} from '../../packages/contracts/authorization-notice';
import type {Entity} from '../../packages/contracts';
import {ApprovalTracker} from '../travel/approval-tracker';
import {planningModuleSchema} from '../../packages/contracts/planning-module';
import {formatReceiptAmount} from '../../packages/contracts/expense-currency';
const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
const date=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const category=(value:string)=>({rental_car:'Rental car',ground_transport:'Ground transport',meals:'Meals & incidentals'}[value]||value.replace(/^./,c=>c.toUpperCase()));
export function AuthorizationMessage({notice,request}:{notice:AuthorizationNotice;request?:Entity}){
 const {trip,formData}=notice.submission;
 const form=planningModuleSchema.safeParse(formData);
 return <>
  <div className="inbox-confirmation"><span className="inbox-check"><Check size={19} aria-hidden="true"/></span><div><strong>Sent for review</strong><p>Your authorization was submitted successfully. It went to S1 for review; submission does not mean approval.</p></div></div>
  {request&&<ApprovalTracker request={request}/>}
  <section aria-labelledby="submitted-trip"><div className="inbox-section-heading"><h2 id="submitted-trip">{trip.destination}</h2><span>{date(trip.departure)} — {date(trip.returnDate)}</span></div>
   <dl className="inbox-trip-details">{form.success&&<><div><dt>Traveler</dt><dd>{form.data.traveler}</dd></div><div><dt>Starting location</dt><dd>{form.data.origin}</dd></div></>}<div><dt>Destination</dt><dd>{trip.destination}</dd></div><div><dt>Time zone</dt><dd>{trip.timezone}</dd></div><div className="inbox-wide"><dt>Purpose</dt><dd>{trip.purpose}</dd></div></dl>
  </section>
  {form.success&&<section aria-labelledby="submitted-budget"><div className="inbox-section-heading"><h2 id="submitted-budget">Submitted expenses</h2><strong>{usd(form.data.approvedExpenseItems.reduce((sum,item)=>sum+item.authorizedAmountMinor,0))} USD</strong></div>
   <div className="inbox-expenses">{form.data.approvedExpenseItems.map(item=><article key={item.id}><header><div><span>{category(item.category)}</span><h3>{item.description}</h3></div><strong>{usd(item.authorizedAmountMinor)}</strong></header><dl><div><dt>Merchant</dt><dd>{item.merchant||'Not specified'}</dd></div><div><dt>Expected payment</dt><dd>{item.expectedPaymentMethod==='gtcc'?'Government travel card':item.expectedPaymentMethod==='personal'?'Personal':'Not specified'}</dd></div>{item.date&&<div><dt>Expense date</dt><dd>{date(item.date)}</dd></div>}{item.startDate&&<div><dt>Stay dates</dt><dd>{date(item.startDate)} — {date(item.endDate!)}</dd></div>}{item.nights!==undefined&&<div><dt>Nights</dt><dd>{item.nights}</dd></div>}{item.originalEstimate&&<><div><dt>Original currency amount</dt><dd>{formatReceiptAmount(item.originalEstimate.amountMinor,item.originalEstimate.currency)}</dd></div><div className="inbox-wide"><dt>Conversion estimate</dt><dd>{item.originalEstimate.conversionNote}</dd></div></>}</dl></article>)}</div>
  </section>}
  <p className="inbox-snapshot-note">This message keeps a copy of the form you submitted. The status above shows where it is now.</p>
  <Link className="inbox-open-plan" href={`/dashboard/travel/planning?tripId=${notice.tripId}`}>View authorization <ArrowUpRight size={16} aria-hidden="true"/></Link>
  <details className="cw-disclosure inbox-record"><summary>Complete submitted record</summary><dl><div><dt>Authorization ID</dt><dd>{notice.authorizationId}</dd></div><div><dt>Submission ID</dt><dd>{notice.revisionId}</dd></div><div><dt>Approval request ID</dt><dd>{notice.requestId}</dd></div><div><dt>Form version</dt><dd>{notice.submission.formSchemaVersion}</dd></div></dl><pre>{JSON.stringify(notice.submission,null,2)}</pre></details>
 </>;
}
