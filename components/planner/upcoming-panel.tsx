'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowUpRight,Check,Plus,Trash2,X} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {addDays,plannerKinds,upcomingEntries,type PlannerKind,type UpcomingEntry} from '@/packages/domain/planner';
import {localToday} from '@/packages/domain/flight-search';
import type {LocalRecord} from '@/packages/offline/database';
import {usePlanner} from './store';
import './planner.css';

const kindNames:Record<UpcomingEntry['kind'],string>={appointment:'Appointment',deadline:'Deadline',deployment:'Deployment',other:'Reminder',trip:'Travel',voucher:'Voucher',checklist:'Checklist'};
const text=(value:unknown)=>typeof value==='string'?value:'';
const daysBetween=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
function when(date:string,today:string){const d=daysBetween(today,date);return d<0?`${-d} day${d===-1?'':'s'} overdue`:d===0?'Today':d===1?'Tomorrow':d<14?`In ${d} days`:d<60?`In ${Math.round(d/7)} weeks`:`In ${Math.round(d/30)} months`}
function group(date:string,today:string){const d=daysBetween(today,date);return d<0?'Overdue':d<7?'This week':d<31?'This month':'Later'}

/** Appointments, deadlines, deployment dates, checklist due dates and travel dates, soonest first. */
export function UpcomingPanel(){
 const p=usePlatform(),{state,update}=usePlanner(),[today]=useState(localToday);
 const [adding,setAdding]=useState(false),[draft,setDraft]=useState({kind:'appointment' as PlannerKind,title:'',date:'',time:''}),[error,setError]=useState('');
 const rows=useLiveQuery<LocalRecord[]>(()=>p.repository?.db.entities.where('kind').anyOf('trip','voucher').toArray()||Promise.resolve([]),[p.repository]);
 const trips=(rows||[]).filter(r=>r.kind==='trip').map(r=>({id:r.id,destination:text(r.local.data.destination),departure:text(r.local.data.departure),returnDate:text(r.local.data.returnDate),
  voucherDone:(rows||[]).some(v=>v.kind==='voucher'&&v.local.tripId===r.id&&['in_review','approved','verified'].includes(v.server?.status||v.local.status))})).filter(t=>t.departure&&t.returnDate);
 const entries=upcomingEntries(state.items,state.checklists,trips,today).filter(e=>e.date<=addDays(today,365));
 const groups=['Overdue','This week','This month','Later'].map(name=>({name,entries:entries.filter(e=>group(e.date,today)===name)})).filter(g=>g.entries.length);
 function add(e:React.FormEvent){
  e.preventDefault();setError('');
  if(!draft.title.trim()||!draft.date){setError('Add a title and a date.');return}
  try{update(s=>({...s,items:[...s.items,{id:crypto.randomUUID(),kind:draft.kind,title:draft.title.trim().slice(0,120),date:draft.date,...(draft.time?{time:draft.time}:{})}]}));setDraft({kind:draft.kind,title:'',date:'',time:''});setAdding(false)}
  catch(err){setError(err instanceof Error?err.message:'Unable to save.')}
 }
 function complete(entry:UpcomingEntry){
  if(entry.itemId)update(s=>({...s,items:s.items.map(i=>i.id===entry.itemId?{...i,done:true}:i)}));
  if(entry.checklist)update(s=>({...s,checklists:s.checklists.map(l=>l.id===entry.checklist!.id?{...l,steps:l.steps.map(st=>st.id===entry.checklist!.stepId?{...st,done:true}:st)}:l)}));
 }
 const remove=(id:string)=>update(s=>({...s,items:s.items.filter(i=>i.id!==id)}));
 return <section className="upcoming" aria-labelledby="upcoming-title">
  <div className="upcoming-head"><h2 id="upcoming-title">Upcoming</h2><button type="button" className="upcoming-add" onClick={()=>{setAdding(v=>!v);setError('')}} aria-expanded={adding}>{adding?<X size={14}/>:<Plus size={14}/>}{adding?'Close':'Add'}</button></div>
  {adding&&<form className="upcoming-form" onSubmit={add}>
   <div className="upcoming-kinds" role="radiogroup" aria-label="Type">{plannerKinds.map(kind=><button key={kind} type="button" role="radio" aria-checked={draft.kind===kind} className={draft.kind===kind?'is-on':''} onClick={()=>setDraft(d=>({...d,kind}))}>{kindNames[kind]}</button>)}</div>
   <Input aria-label="Title" placeholder={draft.kind==='appointment'?'Dental appointment':draft.kind==='deployment'?'Deployment date':draft.kind==='deadline'?'Annual training due':'What to remember'} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} maxLength={120} autoFocus/>
   <div className="upcoming-when"><Input type="date" aria-label="Date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))}/><Input type="time" aria-label="Time (optional)" value={draft.time} onChange={e=>setDraft(d=>({...d,time:e.target.value}))}/></div>
   {error&&<p role="alert" className="upcoming-error">{error}</p>}
   <Button type="submit" className="upcoming-save">Save</Button>
  </form>}
  {!groups.length?<p className="upcoming-empty">Nothing coming up. Add appointments, deadlines or deployment dates, or turn instructions into a checklist with due dates.</p>:
  groups.map(g=><div key={g.name} className="upcoming-group"><h3 className={g.name==='Overdue'?'is-overdue':''}>{g.name}</h3><ul>{g.entries.map(entry=>{const d=new Date(`${entry.date}T12:00:00Z`);return <li key={entry.key} className={`upcoming-row kind-${entry.kind}`}>
   <span className="upcoming-date" aria-hidden="true"><b>{d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}</b>{d.getUTCDate()}</span>
   <div className="upcoming-body"><span className="upcoming-kind">{kindNames[entry.kind]}{entry.time?` · ${entry.time}`:''}</span><strong>{entry.href?<Link href={entry.href}>{entry.title} <ArrowUpRight size={12}/></Link>:entry.title}</strong><small>{when(entry.date,today)}{entry.detail?` · ${entry.detail}`:''}</small></div>
   <div className="upcoming-actions">{(entry.itemId||entry.checklist)&&<button type="button" aria-label={`Mark ${entry.title} done`} onClick={()=>complete(entry)}><Check size={14}/></button>}{entry.itemId&&<button type="button" aria-label={`Remove ${entry.title}`} onClick={()=>remove(entry.itemId!)}><Trash2 size={13}/></button>}</div>
  </li>})}</ul></div>)}
  <p className="upcoming-note">Saved on this device.</p>
 </section>;
}
