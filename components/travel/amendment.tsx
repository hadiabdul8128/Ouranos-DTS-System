'use client';
import {useState} from 'react';
import {PencilLine} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import type {Amendment} from '@/packages/contracts/planning-module';
import {amendmentChanges,type PlanVersion} from '@/packages/domain/amendment';
import './amendment.css';

/** On an approved plan: reopen it as a change that goes back to the approvers. */
export function ChangeTrip({onStart}:{onStart:(reason:string)=>Promise<void>}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){
  if(reason.trim().length<8){setError('Say briefly why the trip is changing, for example “Orders extended to Mar 7”.');return}
  setBusy(true);setError('');
  try{await onStart(reason.trim())}catch(e){setError(e instanceof Error?e.message:'The change couldn’t be started. Try again.');setBusy(false)}
 }
 if(!open)return <div className="change-trip"><div><strong>Need to change this trip?</strong><span>New dates, a new location or different costs go back to your approvers.</span></div><Button type="button" variant="outline" onClick={()=>setOpen(true)}><PencilLine size={15}/> Change my trip</Button></div>;
 return <div className="change-trip is-open">
  <label htmlFor="change-reason"><strong>What’s changing, and why?</strong><span>Your approvers see this with a list of what’s different. Your voucher waits until the change is approved.</span></label>
  <Textarea id="change-reason" value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Orders were extended two days, so I need two more hotel nights." autoFocus/>
  {error&&<p role="alert">{error}</p>}
  <div className="change-trip-actions"><Button type="button" variant="ghost" onClick={()=>{setOpen(false);setError('')}} disabled={busy}>Cancel</Button><Button type="button" onClick={()=>void start()} disabled={busy}>{busy?'Opening…':'Start the change'}</Button></div>
 </div>;
}

/** While a change is in progress: why, and what's different from what was approved. */
export function AmendmentBanner({amendment,current,status}:{amendment:Amendment;current:PlanVersion;status:string}){
 const changes=amendmentChanges(amendment.previous,current);
 return <section className="amendment-banner" aria-labelledby="amendment-title">
  <h2 id="amendment-title">Change {amendment.number} to your approved plan</h2>
  <p className="amendment-reason">“{amendment.reason}”</p>
  <p className="cw-muted">{status==='in_review'?'Sent to your approvers. Your voucher opens again once they approve the change.':status==='changes_requested'?'Your approvers asked for changes. Update the plan and send it again.':'Edit the trip or costs below, then send the change for review. Until it’s approved, the voucher is on hold.'}</p>
  {changes.length?<table className="amendment-changes"><thead><tr><th scope="col">What</th><th scope="col">Approved</th><th scope="col">Now</th></tr></thead><tbody>{changes.map(change=><tr key={change.label}><th scope="row">{change.label}</th><td>{change.from}</td><td>{change.to}</td></tr>)}</tbody></table>:<p className="amendment-none">Nothing changed yet.</p>}
 </section>;
}
