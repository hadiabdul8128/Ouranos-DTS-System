'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ListChecks,Send,Sparkles,Trash2} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {InboxLink} from '@/components/inbox/inbox-link';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {localChecklist,type Checklist} from '@/packages/domain/planner';
import {localToday} from '@/packages/domain/flight-search';
import type {GuideChecklist} from '@/packages/contracts/guide';
import {usePlanner} from './store';
import {UpcomingPanel} from './upcoming-panel';
import './planner.css';

const sourceNote:Record<Checklist['source'],string>={ai:'Written by AI from your instructions. Check it against your orders and chain of command.',guide:'A general starting guide. Your unit’s requirements come first.',instructions:'Built from your instructions, one step per task. Dates become due dates.'};
const day=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});

/** Turn instructions into a checklist, work through it, and ask questions about it. */
export function ChecklistPage(){
 const p=usePlatform(),{state,update}=usePlanner(),[today]=useState(localToday);
 const [params]=useState(()=>typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search));
 const [instructions,setInstructions]=useState(()=>params.get('q')??''),[openId,setOpenId]=useState<string|null>(()=>params.get('checklist')),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const open=state.checklists.find(list=>list.id===openId)??null;
 const started=useRef(false);
 async function build(text:string){
  const source=text.trim();if(source.length<3||busy)return;
  setBusy(true);setNotice('');
  let list:Checklist;
  try{
   if(!p.client||!p.organizationId)throw new Error('offline');
   const {checklist}=await p.client.request<{checklist:GuideChecklist}>('/v1/guide/checklist',{method:'POST',body:JSON.stringify({organizationId:p.organizationId,instructions:source,today})});
   list={id:crypto.randomUUID(),title:checklist.title,source:'ai',instructions:source,createdAt:new Date().toISOString(),steps:checklist.steps.map(step=>({id:crypto.randomUUID(),title:step.title,...(step.detail?{detail:step.detail}:{}),...(step.due?{due:step.due}:{})}))};
  }catch{list=localChecklist(source,today)}
  try{update(s=>({...s,checklists:[list,...s.checklists].slice(0,30)}));setOpenId(list.id);setInstructions('')}
  catch(err){setNotice(err instanceof Error?err.message:'Unable to save the checklist.')}
  finally{setBusy(false)}
 }
 // Build straight away when arriving from the home prompt.
 useEffect(()=>{const q=params.get('q');if(!q||started.current)return;started.current=true;window.history.replaceState(null,'','/dashboard/guide');setTimeout(()=>void build(q))},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const change=(id:string,patch:(list:Checklist)=>Checklist)=>update(s=>({...s,checklists:s.checklists.map(list=>list.id===id?patch(list):list)}));
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <div className="guide-layout"><section className="guide-main">
   <Link href="/dashboard" className="back-link"><ArrowLeft size={14}/> Home</Link>
   <h1 className="guide-title">Checklists.</h1>
   <form className="guide-input" onSubmit={e=>{e.preventDefault();void build(instructions)}}>
    <label htmlFor="guide-instructions">What do you need to get done?</label>
    <Textarea id="guide-instructions" value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={6000} placeholder={'Type a task, like “prepare for deployment”, or paste instructions you were given:\n- Complete PHA NLT 15 Oct\n- Update DD 93 and SGLI\n- Turn in gear by 10/30'} disabled={busy}/>
    <Button type="submit" disabled={busy||instructions.trim().length<3}><ListChecks size={16}/>{busy?'Building your checklist…':'Make a checklist'}</Button>
    {notice&&<p role="alert" className="upcoming-error">{notice}</p>}
   </form>
   {state.checklists.length>0&&<nav className="guide-lists" aria-label="Your checklists">{state.checklists.map(list=>{const done=list.steps.filter(s=>s.done).length;return <button key={list.id} type="button" aria-current={list.id===open?.id?'true':undefined} onClick={()=>setOpenId(list.id)}>{list.title}<span>{done}/{list.steps.length}</span></button>})}</nav>}
   {open&&<ChecklistView key={open.id} list={open} onChange={patch=>change(open.id,patch)} onDelete={()=>{update(s=>({...s,checklists:s.checklists.filter(l=>l.id!==open.id)}));setOpenId(null)}}/>}
  </section><aside className="guide-side"><UpcomingPanel/></aside></div>
  <footer className="cw-footer"><span/><SyncIndicator/></footer>
 </main>;
}

function ChecklistView({list,onChange,onDelete}:{list:Checklist;onChange:(patch:(list:Checklist)=>Checklist)=>void;onDelete:()=>void}){
 const done=list.steps.filter(s=>s.done).length;
 const setStep=(id:string,patch:Partial<Checklist['steps'][number]>)=>onChange(l=>({...l,steps:l.steps.map(s=>s.id===id?{...s,...patch}:s)}));
 return <article className="guide-checklist" aria-labelledby="checklist-title">
  <header><div><h2 id="checklist-title">{list.title}</h2><p>{sourceNote[list.source]}</p></div><button type="button" className="guide-delete" onClick={onDelete} aria-label="Delete this checklist"><Trash2 size={15}/></button></header>
  <div className="guide-progress" role="progressbar" aria-valuemin={0} aria-valuemax={list.steps.length} aria-valuenow={done} aria-label={`${done} of ${list.steps.length} done`}><i style={{width:`${list.steps.length?done/list.steps.length*100:0}%`}}/></div>
  <p className="guide-count">{done} of {list.steps.length} done</p>
  <ol className="guide-steps">{list.steps.map((step,i)=><li key={step.id} className={step.done?'is-done':''}>
   <label className="guide-check"><input type="checkbox" checked={Boolean(step.done)} onChange={e=>setStep(step.id,{done:e.target.checked})}/><span className="guide-box" aria-hidden="true">{i+1}</span><span className="guide-step-title">{step.title}</span></label>
   {step.detail&&<p className="guide-detail">{step.detail}</p>}
   <div className="guide-due">{step.due?<><span>Due {day(step.due)}</span><button type="button" onClick={()=>setStep(step.id,{due:undefined})}>Remove date</button></>:<label>Add a due date <input type="date" onChange={e=>e.target.value&&setStep(step.id,{due:e.target.value})}/></label>}</div>
  </li>)}</ol>
  <AskBox list={list}/>
 </article>;
}

function AskBox({list}:{list:Checklist}){
 const p=usePlatform();
 const [question,setQuestion]=useState(''),[messages,setMessages]=useState<{role:'user'|'assistant';content:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function ask(e:React.FormEvent){
  e.preventDefault();if(!question.trim()||busy)return;
  if(!p.client||!p.organizationId){setError('Connect your workspace to ask questions.');return}
  const next=[...messages.slice(-8),{role:'user' as const,content:question.trim()}];setBusy(true);setError('');
  try{const {answer}=await p.client.request<{answer:string}>('/v1/guide/ask',{method:'POST',body:JSON.stringify({organizationId:p.organizationId,checklist:{title:list.title,steps:list.steps.map(s=>({title:s.title,...(s.detail?{detail:s.detail}:{}),done:Boolean(s.done)}))},messages:next})});setMessages([...next,{role:'assistant',content:answer}]);setQuestion('')}
  catch(err){setError(err instanceof Error?err.message:'Unable to answer right now.')}
  finally{setBusy(false)}
 }
 return <section className="guide-ask" aria-labelledby="ask-title"><h3 id="ask-title"><Sparkles size={14}/> Ask about this checklist</h3>
  {messages.length>0&&<div className="guide-messages" aria-live="polite">{messages.map((m,i)=><p key={i} className={m.role==='user'?'is-user':''}>{m.content}</p>)}</div>}
  <form onSubmit={ask}><input aria-label="Your question" placeholder="Where do I update my SGLI?" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} disabled={busy}/><Button type="submit" size="icon" aria-label="Ask" disabled={busy||!question.trim()}><Send size={15}/></Button></form>
  {busy&&<p className="guide-thinking" role="status">Thinking…</p>}{error&&<p role="alert" className="upcoming-error">{error}</p>}
 </section>;
}
