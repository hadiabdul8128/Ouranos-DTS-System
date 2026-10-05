'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowUpRight,Plus,Send,UserMinus} from 'lucide-react';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {InboxLink} from '@/components/inbox/inbox-link';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {teamLevelNames,type TeamLevel,type TeamPerson,type TeamTrip} from '@/packages/contracts/team';
import {localToday} from '@/packages/domain/flight-search';
import './team-page.css';

const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
const day=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const message=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Try again.';
const planWords:Record<string,string>={draft:'Plan is a draft',in_review:'In review',approved:'Plan approved',changes_requested:'Sent back for changes',rejected:'Not approved'};

/** Where a trip stands, in the words a leader needs. */
function tripState(trip:TeamTrip){
 if(trip.approval?.waitingOnYou)return {text:'Waiting on you',tone:'you'};
 if(trip.approval?.status==='in_review')return {text:`With ${trip.approval.current??'reviewers'}`,tone:'wait'};
 if(trip.payStatus==='not_filed')return {text:'Voucher not filed',tone:'late'};
 if(trip.payStatus==='awaiting')return {text:'Voucher filed, not paid',tone:'wait'};
 if(trip.payStatus==='paid')return {text:`Paid ${usd(trip.paidMinor??0)}`,tone:'done'};
 return {text:trip.planStatus?planWords[trip.planStatus]??trip.planStatus:'No plan yet',tone:trip.planStatus==='approved'?'done':'quiet'};
}

/** Leaders see the people they added, what's waiting on them, what's late, and the money. */
export function TeamPage(){
 const p=usePlatform(),[today]=useState(localToday);
 const role=p.memberships.find(m=>m.organizationId===p.organizationId)?.role;
 const levels:TeamLevel[]=role==='admin'?['s1','command']:role==='reviewer'?['s1']:role==='approver'?['command']:[];
 const [people,setPeople]=useState<TeamPerson[]|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[level,setLevel]=useState<TeamLevel>(levels[0]??'s1'),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(!p.client||!p.organizationId)return;
  try{setPeople((await p.client.request<{people:TeamPerson[]}>(`/v1/team?organizationId=${p.organizationId}&today=${today}`)).people);setError('')}
  catch(e){setError(message(e));setPeople([])}
 },[p.client,p.organizationId,today]);
 useEffect(()=>{const timer=setTimeout(()=>void load());return()=>clearTimeout(timer)},[load]);
 async function add(e:React.FormEvent){
  e.preventDefault();if(!p.client||!p.organizationId||busy)return;setBusy(true);setError('');setNotice('');
  try{await p.client.request('/v1/team/members',{method:'POST',body:JSON.stringify({organizationId:p.organizationId,email:email.trim(),level})});setNotice(`${email.trim()} added. Their requests now come to you at ${teamLevelNames[level]}.`);setEmail('');await load()}
  catch(err){setError(message(err))}finally{setBusy(false)}
 }
 async function remove(person:TeamPerson,at:TeamLevel){
  if(!p.client||!p.organizationId)return;setError('');setNotice('');
  try{await p.client.request('/v1/team/members',{method:'DELETE',body:JSON.stringify({organizationId:p.organizationId,memberId:person.memberId,level:at})});setNotice(`${person.email} removed from your team.`);await load()}
  catch(err){setError(message(err))}
 }
 if(!levels.length)return <main className="quiet-page cw-page"><section className="cw-shell"><Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link><h1>My people</h1><p className="cw-muted">Only S1 reviewers, command approvers and admins lead people in Ouranos.</p></section></main>;
 const list=people??[],waiting=list.reduce((n,x)=>n+x.waitingOnYou,0),late=list.filter(x=>x.overdue.length).length;
 const sum=(key:keyof TeamPerson['totals'])=>list.reduce((n,x)=>n+x.totals[key],0);
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform">Settings</Link></nav></header>
  <section className="cw-shell team-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <h1>My people</h1>
   <p className="team-sub">{people===null?'Loading your team…':`${list.length} ${list.length===1?'person':'people'} · ${waiting} waiting on you · ${late} with something overdue`}</p>
   {waiting>0&&<Link className="team-review" href="/dashboard/review">Review {waiting} {waiting===1?'request':'requests'} now <ArrowUpRight size={15}/></Link>}
   <form className="team-add" onSubmit={add}>
    <label htmlFor="team-email">Add someone from your workspace</label>
    <div><Input id="team-email" type="email" placeholder="their.email@unit.mil" value={email} onChange={e=>setEmail(e.target.value)} required/>
     {levels.length>1?<select aria-label="Level" value={level} onChange={e=>setLevel(e.target.value as TeamLevel)}>{levels.map(l=><option key={l} value={l}>As their {teamLevelNames[l]}</option>)}</select>:<span className="team-level">As their {teamLevelNames[levels[0]!]}</span>}
     <Button type="submit" disabled={busy}><Plus size={16}/>{busy?'Adding…':'Add'}</Button></div>
    <small>Their travel requests will come to you automatically. They don’t pick a reviewer.</small>
   </form>
   {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="team-notice">{notice}</p>}
   {list.length>0&&<dl className="team-totals"><div><dt>Planned</dt><dd>{usd(sum('plannedMinor'))}</dd></div><div><dt>Claimed</dt><dd>{usd(sum('claimedMinor'))}</dd></div><div><dt>Paid</dt><dd>{usd(sum('paidMinor'))}</dd></div><div><dt>Still owed</dt><dd>{usd(sum('awaitingMinor'))}</dd></div></dl>}
   {people!==null&&!list.length&&<p className="team-empty">No one on your team yet. Add people by the email they sign in with.</p>}
   <ul className="team-people">{list.map(person=><PersonCard key={person.memberId} person={person} today={today} onRemove={at=>void remove(person,at)}/>)}</ul>
   {list.length>0&&<ChecklistComposer people={list} onSent={async text=>{setNotice(text);await load()}}/>}
  </section><footer className="cw-footer"><span/><SyncIndicator/></footer></main>;
}

function PersonCard({person,today,onRemove}:{person:TeamPerson;today:string;onRemove:(level:TeamLevel)=>void}){
 const active=person.trips.filter(t=>t.phase!=='past'||t.payStatus!=='paid');
 return <li className="team-person">
  <header><div><h2>{person.email}</h2><p>You are their {person.levels.map(l=>teamLevelNames[l]).join(' and ')||'admin'} · {person.totals.trips} {person.totals.trips===1?'trip':'trips'}</p></div>
   <div className="team-flags">{person.waitingOnYou>0&&<span className="team-flag is-you">{person.waitingOnYou} waiting on you</span>}{person.overdue.length>0&&<span className="team-flag is-late">{person.overdue.length} overdue</span>}{!person.waitingOnYou&&!person.overdue.length&&<span className="team-flag">On track</span>}</div></header>
  {person.overdue.length>0&&<ul className="team-overdue">{person.overdue.map((item,i)=><li key={i}>{item.label}</li>)}</ul>}
  {active.length>0&&<table className="team-trips"><thead><tr><th scope="col">Trip</th><th scope="col">Dates</th><th scope="col">Where it stands</th><th scope="col">Planned</th><th scope="col">Paid</th></tr></thead><tbody>{active.slice(0,6).map(trip=>{const state=tripState(trip);return <tr key={trip.id}><th scope="row">{trip.destination}</th><td>{day(trip.departure)}–{day(trip.returnDate)}</td><td><span className={`team-state is-${state.tone}`}>{state.text}</span></td><td>{trip.plannedMinor===null?'—':usd(trip.plannedMinor)}</td><td>{trip.paidMinor===null?'—':usd(trip.paidMinor)}</td></tr>})}</tbody></table>}
  {person.checklists.length>0&&<ul className="team-checks">{person.checklists.map(c=><li key={c.id}><span>{c.title}{c.dueOn?<small> · due {day(c.dueOn)}{c.dueOn<today&&c.done<c.total?' (late)':''}</small>:null}</span><i style={{'--p':`${c.total?c.done/c.total*100:0}%`} as React.CSSProperties} aria-hidden="true"/><b>{c.done}/{c.total}</b></li>)}</ul>}
  <footer><span>Planned {usd(person.totals.plannedMinor)} · Claimed {usd(person.totals.claimedMinor)} · Paid {usd(person.totals.paidMinor)}</span>{person.levels.map(l=><button key={l} type="button" onClick={()=>onRemove(l)}><UserMinus size={14}/> Remove{person.levels.length>1?` as ${teamLevelNames[l]}`:''}</button>)}</footer>
 </li>;
}

function ChecklistComposer({people,onSent}:{people:TeamPerson[];onSent:(text:string)=>Promise<void>}){
 const p=usePlatform();
 const [title,setTitle]=useState(''),[steps,setSteps]=useState(''),[dueOn,setDueOn]=useState(''),[chosen,setChosen]=useState<string[]>(()=>people.map(x=>x.memberId)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(e:React.FormEvent){
  e.preventDefault();if(!p.client||!p.organizationId||busy)return;setError('');
  const lines=steps.split(/\r?\n/).map(s=>s.replace(/^[-*•\d.)\s]+/,'').trim()).filter(Boolean);
  if(!lines.length){setError('Add at least one step, one per line.');return}
  if(!chosen.length){setError('Choose who gets it.');return}
  setBusy(true);
  try{await p.client.request('/v1/team/checklists',{method:'POST',body:JSON.stringify({organizationId:p.organizationId,title:title.trim(),steps:lines.slice(0,40).map((line,i)=>({id:`s${i+1}`,title:line.slice(0,200)})),...(dueOn?{dueOn}:{}),memberIds:chosen})});setTitle('');setSteps('');setDueOn('');await onSent(`Checklist sent to ${chosen.length} ${chosen.length===1?'person':'people'}.`)}
  catch(err){setError(message(err))}finally{setBusy(false)}
 }
 return <form className="team-compose" onSubmit={send}>
  <h2>Send a checklist</h2><p>Pass instructions down. Each person checks off steps, and you see their progress above.</p>
  <label>Title<Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="Deployment prep" required/></label>
  <label>Steps, one per line<Textarea value={steps} onChange={e=>setSteps(e.target.value)} rows={5} placeholder={'Update DD 93 and SGLI\nComplete PHA\nTurn in CIF gear'}/></label>
  <label>Due date (optional)<Input type="date" value={dueOn} onChange={e=>setDueOn(e.target.value)}/></label>
  <fieldset><legend>Send to</legend>{people.map(x=><label key={x.memberId} className="team-pick"><input type="checkbox" checked={chosen.includes(x.memberId)} onChange={e=>setChosen(c=>e.target.checked?[...c,x.memberId]:c.filter(id=>id!==x.memberId))}/>{x.email}</label>)}</fieldset>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <Button type="submit" disabled={busy}><Send size={15}/>{busy?'Sending…':'Send checklist'}</Button>
 </form>;
}
