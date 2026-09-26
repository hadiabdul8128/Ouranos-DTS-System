'use client';
import Link from 'next/link';
import {Suspense,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,Check,FileText} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {planningModuleSchema} from '@/packages/contracts/planning-module';
import type {VerificationReport} from '@/packages/domain/voucher-verification';
import {TravelPackagePanel} from '@/components/travel/package-panel';

type Row=Record<string,unknown>;
const record=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.map(record):[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const money=(minor:unknown)=>typeof minor==='number'&&Number.isSafeInteger(minor)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100):'—';
const data=(entity:unknown)=>record(record(entity).data);

function VoucherVerificationDetailsContent(){
 const platform=usePlatform();
 const searchParams=useSearchParams();
 const tripId=searchParams.get('tripId')||'',voucherId=searchParams.get('voucherId')||'';
 const [detail,setDetail]=useState<{report:VerificationReport;revision:{id:string;sha256:string;snapshot:Row;createdAt:string}}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{if(!voucherId||!platform.client||!platform.organizationId)return;let active=true;
  void platform.client.voucherVerification(voucherId,platform.organizationId).then(result=>{if(active){setDetail(result);setError('')}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Verification details are unavailable.')});
  return()=>{active=false};
 },[voucherId,platform.client,platform.organizationId]);
 const report=detail?.report,snapshot=record(detail?.revision.snapshot),trip=data(snapshot.trip),planRevision=record(snapshot.authorizationRevision),authorization=record(record(planRevision.snapshot).entity);
 const parsedPlan=planningModuleSchema.safeParse(data(authorization).formData);
 const form=data(snapshot.entity).formData;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link></header><section className="cw-shell">
  <Link className="back-link" href={tripId?`/dashboard/travel/vouchers?tripId=${tripId}`:'/dashboard/travel'}><ArrowLeft size={14}/> Back to voucher</Link>
  <div className="cw-heading"><div><p className="cw-eyebrow">Voucher · verification details</p><h1>{report?.status==='verified'?'Verified by Ouranos.':'Verification details.'}</h1><p className="cw-muted">{report?.status==='verified'?'Ready for DTS review. Official DoD approval and payment remain outside Ouranos.':'The traveler can correct the items below and run verification again.'}</p></div></div>
  {error&&<p className="cw-card cw-error" role="alert">{error}</p>}
  {!report&&!error&&<p className="cw-muted" role="status">Loading verification details…</p>}
  {report&&<>
   <section className="cw-card"><h2>{report.status==='verified'?'Verification passed':'Needs action'}</h2><p className="cw-muted">{report.checksPassed} checks passed · {report.expenseCount} expenses · {report.receiptCount} confirmed receipts</p><div className="cw-totals"><div><span>Claimed</span><strong>{money(report.claimedTotalMinor)}</strong></div><div><span>GTCC</span><strong>{money(report.gtccTotalMinor)}</strong></div><div><span>Personal funds</span><strong>{money(report.personalFundsTotalMinor)}</strong></div></div>{report.blockingIssues.length>0&&<div className="cw-issues"><h3>{report.blockingIssues.length} thing{report.blockingIssues.length===1?'':'s'} need your attention</h3>{report.blockingIssues.map(issue=><p key={issue.id}>{issue.message}</p>)}</div>}<p className="cw-muted">Checked {new Date(report.checkedAt).toLocaleString()} · Rules {report.ruleVersion}</p></section>
   <section className="cw-card"><h2>Approved travel</h2><p>{text(data(authorization).origin)} → {text(trip.destination)}</p><p className="cw-muted">{text(trip.departure)} – {text(trip.returnDate)} · Authorization revision {report.authorizationRevisionId}</p>{parsedPlan.success&&<div className="connected-review-items">{parsedPlan.data.approvedExpenseItems.map(item=><div className="connected-review-item" key={item.id}><strong>{item.description}</strong><span> · {money(item.authorizedAmountMinor)} · {item.category.replaceAll('_',' ')}</span></div>)}</div>}</section>
   <section className="cw-card"><h2>Frozen expenses and receipts</h2>{rows(snapshot.expenses).map(expense=><article className="connected-review-item" key={text(expense.id)}><div className="connected-review-item-header"><div><strong>{text(data(expense).merchant)}</strong><p className="cw-muted">{text(data(expense).incurredOn)} · {text(data(expense).category).replaceAll('_',' ')}</p></div><strong>{money(data(expense).amountMinor)}</strong></div><p className="cw-muted">Payment: {text(data(expense).paymentMethod)||'Not specified'} · Approved item: {text(data(expense).authorizationItemId)||'None'}</p></article>)}<h3>Receipt evidence</h3>{rows(snapshot.documents).length?rows(snapshot.documents).map(document=><p className="cw-muted" key={text(document.id)}><FileText size={14}/> {text(data(document).filename)} · {text(document.status)} · SHA-256 {text(data(document).sha256)}</p>):<p className="cw-muted">No receipts were required or attached.</p>}</section>
   <section className="cw-card"><h2>Why this result</h2>{report.warnings.length>0&&<div className="cw-issues">{report.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>}<details className="cw-disclosure"><summary>{report.checksPassed} checks passed</summary><ul>{report.checks.map((check,index)=><li key={`${check.code}:${index}`}><Check size={13}/> {check.code.replaceAll('_',' ')}{check.status==='resolved'?' · traveler resolution':''}</li>)}</ul></details><details className="cw-disclosure"><summary>Recorded explanations</summary><pre>{JSON.stringify(record(record(form).resolutions),null,2)}</pre></details><p className="cw-muted">Frozen voucher revision {report.voucherRevisionId}</p><p className="cw-fingerprint">SHA-256 <code>{report.snapshotSha256}</code></p></section>
   {report.status==='verified'&&<TravelPackagePanel voucherId={report.voucherId} refreshKey={report.voucherRevisionId}/>}
  </>}
 </section></main>;
}

export default function VoucherVerificationDetails(){return <Suspense fallback={<main className="quiet-page cw-page"><p role="status">Loading verification details…</p></main>}><VoucherVerificationDetailsContent/></Suspense>}
