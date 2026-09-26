'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePlatform} from '@/components/platform/provider';
import {OuranosClient,ApiFailure} from '@/packages/sdk';
import {transitionPlanSchema,type TransitionPlan,type TransitionProfile,type TransitionSave,type TransitionPathId} from '@/packages/contracts/transition';
import {TransitionIntake} from './intake';
import {TransitionOptions} from './options';
import {TransitionSupport} from './support';

export default function TransitionWorkspace(){
 const {client,organizationId,session}=usePlatform();
 return <main className="quiet-page transition-page">
  <header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link href="/dashboard" className="back-link">Workspace</Link></header>
  {client&&organizationId&&session?<Journey key={`${session.user.id}:${organizationId}`} client={client} organizationId={organizationId}/>:<div className="transition-content"><h1>Life after the military</h1><p>Connect your workspace to save a personal plan.</p><Link href="/dashboard/platform">Open workspace settings →</Link><TransitionSupport/></div>}
 </main>;
}
function Journey({client,organizationId}:{client:OuranosClient;organizationId:string}){
 const [plan,setPlan]=useState<TransitionPlan|null>(null),[loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false),[reloadKey,setReloadKey]=useState(0);
 const pending=useRef<TransitionSave|null>(null),saving=useRef(false),active=useRef(true);
 const content=useRef<HTMLDivElement>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 useEffect(()=>{
  let cancelled=false;setLoading(true);setLoadFailed(false);setError('');
  void client.transitionPlan(organizationId).then(result=>{
   if(cancelled)return;setPlan(result.plan?transitionPlanSchema.parse(result.plan):null);setEditing(false);pending.current=null;setUncertain(false);setConflict(false);
  }).catch(e=>{if(!cancelled){setLoadFailed(true);setError(e instanceof Error?e.message:'Unable to load your plan')}}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[client,organizationId,reloadKey]);
 async function save(input:TransitionSave){
  if(saving.current)return;saving.current=true;pending.current=input;setBusy(true);setError('');
  try{
   const result=await client.saveTransitionPlan(input);if(!active.current)return;
   setPlan(transitionPlanSchema.parse(result.plan));pending.current=null;setEditing(false);setUncertain(false);setConflict(false);
   if(!plan||editing||plan.selectedPath!==input.selectedPath)requestAnimationFrame(()=>content.current?.focus());
  }catch(e){
   if(!active.current)return;
   const uncertainResult=!(e instanceof ApiFailure)||e.status>=500;
   setUncertain(uncertainResult);setConflict(e instanceof ApiFailure&&e.error.code==='VERSION_CONFLICT');
   if(!uncertainResult)pending.current=null;
   setError(uncertainResult?'We could not confirm the save. Retry the same change or reload your saved plan.':e instanceof Error?e.message:'Unable to save your plan');
  }finally{saving.current=false;if(active.current)setBusy(false)}
 }
 function change(profile:TransitionProfile,selectedPath:TransitionPathId|null,completedActionIds:string[]){
  void save({organizationId,requestId:crypto.randomUUID(),expectedVersion:plan?.version||0,profile,selectedPath,completedActionIds});
 }
 const blocked=busy||uncertain||conflict;
 return <div className="transition-content" ref={content} tabIndex={-1}>
  <p className="transition-eyebrow">Ouranos Transition</p><h1>Life after the military.</h1><p className="transition-intro">You do not need to have it all figured out. Find a direction, then take one step at a time.</p>
  <TransitionSupport open={plan?.profile.housingSupport}/>
  {error&&<div className="transition-error" role="alert"><p>{error}</p>{uncertain&&pending.current&&<button className="transition-text-button" disabled={busy} onClick={()=>void save(pending.current!)}>Retry save</button>}<button className="transition-text-button" disabled={busy} onClick={()=>setReloadKey(k=>k+1)}>Reload saved plan</button></div>}
  {loading?<p role="status">Opening your plan…</p>:loadFailed?null:!plan||editing?<TransitionIntake key={plan?.version||'new'} initial={plan?.profile} busy={blocked} onSave={profile=>change(profile,null,[])} onCancel={plan?()=>setEditing(false):undefined}/>:<TransitionOptions key={`${plan.id}:${plan.selectedPath||'options'}`} plan={plan} busy={blocked} onChoose={id=>change(plan.profile,id,[])} onComplete={ids=>change(plan.profile,plan.selectedPath,ids)} onEdit={()=>setEditing(true)}/>}
  {plan&&!loading&&!editing&&<p className="transition-save-status" role="status">{busy?'Saving…':uncertain||conflict?'Your last confirmed save is shown.':'Saved to your account · you can come back anytime.'}</p>}
 </div>;
}
