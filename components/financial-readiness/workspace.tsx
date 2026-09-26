'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePlatform} from '@/components/platform/provider';
import {OuranosClient,ApiFailure} from '@/packages/sdk';
import {financialPlanSchema,type FinancialPlan,type FinancialProfile,type FinancialSave} from '@/packages/contracts/financial-readiness';
import {FinancialIntake} from './intake';
import {FinancialSummary} from './summary';
import {FinancialCheckIn} from './check-in';
export default function FinancialReadinessWorkspace(){
 const {client,organizationId,session}=usePlatform();
 return <main className="quiet-page finance-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link href="/dashboard" className="back-link">Workspace</Link></header>{client&&organizationId&&session?<Journey key={`${session.user.id}:${organizationId}`} client={client} organizationId={organizationId}/>:<div className="finance-content"><h1>Financial Readiness</h1><p>Connect your workspace to save a private financial plan.</p><Link href="/dashboard/platform">Open workspace settings →</Link></div>}</main>;
}
function Journey({client,organizationId}:{client:OuranosClient;organizationId:string}){
 const [plan,setPlan]=useState<FinancialPlan|null>(null),[mode,setMode]=useState<'summary'|'edit'|'check_in'>('summary'),[loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false),[reloadKey,setReloadKey]=useState(0);
 const pending=useRef<FinancialSave|null>(null),saving=useRef(false),active=useRef(true),content=useRef<HTMLDivElement>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 useEffect(()=>{
  let cancelled=false;
  void client.financialPlan(organizationId).then(result=>{if(cancelled)return;setPlan(result.plan?financialPlanSchema.parse(result.plan):null);setMode('summary');pending.current=null;setUncertain(false);setConflict(false)}).catch(e=>{if(!cancelled){setLoadFailed(true);setError(e instanceof Error?e.message:'Unable to load your plan')}}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[client,organizationId,reloadKey]);
 async function save(input:FinancialSave){
  if(saving.current)return;saving.current=true;pending.current=input;setBusy(true);setError('');
  try{const result=await client.saveFinancialPlan(input);if(!active.current)return;setPlan(financialPlanSchema.parse(result.plan));pending.current=null;setMode('summary');setUncertain(false);setConflict(false);if(!plan||mode!=='summary')requestAnimationFrame(()=>content.current?.focus())}
  catch(e){if(!active.current)return;const unknown=!(e instanceof ApiFailure)||e.status>=500;setUncertain(unknown);setConflict(e instanceof ApiFailure&&e.error.code==='VERSION_CONFLICT');if(!unknown)pending.current=null;setError(unknown?'We could not confirm the save. Retry the same change or reload your saved plan.':e instanceof Error?e.message:'Unable to save your plan')}
  finally{saving.current=false;if(active.current)setBusy(false)}
 }
 function change(profile:FinancialProfile,recordCheckIn:boolean){void save({organizationId,requestId:crypto.randomUUID(),expectedVersion:plan?.version||0,profile,recordCheckIn})}
 function open(next:'edit'|'check_in'){setMode(next);requestAnimationFrame(()=>content.current?.focus())}
 const blocked=busy||uncertain||conflict;
 return <div className="finance-content" ref={content} tabIndex={-1}><p className="finance-product-name">Ouranos Financial Readiness</p><h1>Your money. Your next chapter.</h1><p className="finance-intro">See what each paycheck can cover, build your savings, and plan for life after service.</p>
  {error&&<div className="finance-error" role="alert"><p>{error}</p>{uncertain&&<button className="finance-text-button" disabled={busy} onClick={()=>{const input=pending.current;if(input)void save(input)}}>Retry save</button>}<button className="finance-text-button" disabled={busy} onClick={()=>{setLoading(true);setLoadFailed(false);setError('');setReloadKey(k=>k+1)}}>Reload saved plan</button></div>}
  {loading?<p role="status">Opening your plan…</p>:loadFailed?null:!plan||mode==='edit'?<FinancialIntake key={plan?.version||'new'} initial={plan?.profile} busy={blocked} onSave={p=>change(p,true)} onCancel={plan?()=>setMode('summary'):undefined}/>:mode==='check_in'?<FinancialCheckIn key={plan.version} profile={plan.profile} busy={blocked} onSave={p=>change(p,true)} onCancel={()=>setMode('summary')}/>:<FinancialSummary plan={plan} busy={blocked} onEdit={()=>open('edit')} onCheckIn={()=>open('check_in')} onApply={p=>change(p,false)}/>}
  {plan&&!loading&&mode==='summary'&&<p className="finance-save-status" role="status">{busy?'Saving…':uncertain||conflict?'Your last confirmed save is shown.':'Saved to your account. Come back for your next check-in.'}</p>}
 </div>;
}
