'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import type {TransitionPlan,TransitionPathId} from '@/packages/contracts/transition';
import {transitionResource} from '@/packages/domain/transition/resources';
export function TransitionOptions({plan,busy,onChoose,onComplete,onEdit}:{plan:TransitionPlan;busy:boolean;onChoose:(id:TransitionPathId|null)=>void;onComplete:(ids:string[])=>void;onEdit:()=>void}){
 const [view,setView]=useState<TransitionPathId>(plan.selectedPath||plan.recommendation.paths[0].id);
 const selected=plan.recommendation.paths.find(p=>p.id===plan.selectedPath);
 const path=plan.recommendation.paths.find(p=>p.id===view)!;
 return <section className="transition-options" aria-labelledby="transition-options-title">
  <div className="transition-section-head"><div><p className="transition-eyebrow">{selected?'Your next steps':'Three routes to explore'}</p><h2 id="transition-options-title">{selected?'Start with this week.':'You have options.'}</h2></div><button className="transition-text-button" disabled={busy} onClick={onEdit}>Edit answers</button></div>
  {selected?<>
   <p className="transition-selected-title">{selected.title}</p><p className="transition-muted">These are starting steps, not a deadline. Take them at your own pace.</p>
   <p className="transition-progress" role="status">{plan.completedActionIds.length} of 3 steps done{plan.completedActionIds.length===3?' · Your first steps are complete. Keep going with a counselor.':''}</p>
   <ol className="transition-action-list">{selected.actions.map(action=>{const resource=transitionResource(action.resourceId);return <li key={action.id} className={plan.completedActionIds.includes(action.id)?'is-complete':''}>
    <label className="transition-action-title"><input type="checkbox" disabled={busy} checked={plan.completedActionIds.includes(action.id)} onChange={e=>onComplete(e.target.checked?[...plan.completedActionIds,action.id]:plan.completedActionIds.filter(id=>id!==action.id))}/><span>{action.title}</span></label>
    <p>{action.detail}</p>{resource&&<a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title} ↗<small>{resource.organization}</small></a>}
   </li>})}</ol>
   <button className="transition-text-button" disabled={busy} onClick={()=>onChoose(null)}>Explore another route</button>
  </>:<>
   <p className="transition-muted">Ordered using your goals and income timing. Choose the direction you want to explore first.</p>
   <div className="transition-path-picker" role="group" aria-label="Explore your options">{plan.recommendation.paths.map((p,i)=><button key={p.id} type="button" aria-pressed={view===p.id} disabled={busy} onClick={()=>setView(p.id)}><span className="transition-path-number">0{i+1}</span><span><strong>{p.title}</strong><span>{p.summary}</span></span><span aria-hidden="true">→</span></button>)}</div>
   <section className="transition-path-detail" aria-label={path.title}>
    <h3>{path.title}</h3><h4>Why explore this</h4><ul>{path.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
    <h4>Before you commit</h4><ul>{path.considerations.map(reason=><li key={reason}>{reason}</li>)}</ul>
    <Button disabled={busy} onClick={()=>onChoose(path.id)}>{busy?'Saving…':'Make my next-step plan'}</Button>
   </section>
  </>}
  <p className="transition-fine">Guided suggestions based on your answers. Ouranos does not determine benefit eligibility or guarantee jobs, pay, or admission.</p>
 </section>;
}
