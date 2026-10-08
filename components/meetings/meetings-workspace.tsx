'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useSearchParams,useRouter} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,CalendarDays,Clock,Copy,Plus,Video,X} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {InboxLink} from '@/components/inbox/inbox-link';
import {useMeetings} from './store';
import {canJoinMeeting} from '@/packages/domain/meetings';
import {meetingParticipants} from '@/packages/domain/meetings';
import type {Meeting} from '@/packages/contracts/meetings';
import './meetings.css';
const CallRoom=dynamic(()=>import('./call-room'),{ssr:false,loading:()=> <p role="status">Preparing your call…</p>});
const dateTime=(value:string)=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const duration=(m:Meeting)=>Math.round((Date.parse(m.endsAt)-Date.parse(m.startsAt))/60000);
function nextStart(){const d=new Date(Date.now()+3600000);d.setMinutes(0,0,0);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)}
export function MeetingsWorkspace(){
 const p=usePlatform();return <MeetingsView key={`${p.organizationId}:${p.session?.user.id}`} />;
}
function MeetingsView(){
 const s=useMeetings(),p=usePlatform(),router=useRouter(),params=useSearchParams();
 const selected=params.get('meeting'),selectedMeeting=s.meetings.find(m=>m.id===selected);
 const [mode,setMode]=useState<'now'|'schedule'|null>(null),[title,setTitle]=useState(''),[start,setStart]=useState(nextStart),[minutes,setMinutes]=useState('30'),[emails,setEmails]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[callId,setCallId]=useState<string|null>(null),[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);
 const upcoming=s.meetings.filter(m=>m.status==='scheduled'&&Date.parse(m.endsAt)>now).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 const previous=s.meetings.filter(m=>m.status==='cancelled'||Date.parse(m.endsAt)<=now).sort((a,b)=>b.startsAt.localeCompare(a.startsAt));
 function open(id:string){setError('');setNotice('');router.push(`/dashboard/meetings?meeting=${id}`)}
 function begin(type:'now'|'schedule'){setMode(type);setTitle(type==='now'?'Quick meeting':'');setError('');setNotice('');setStart(nextStart())}
 async function create(e:React.FormEvent){
  e.preventDefault();if(busy)return;setError('');setBusy(true);
  try{
   const startsAt=mode==='now'?new Date():new Date(start);
   if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<Date.now()-60000)throw new Error('Choose a future date and time.');
   const meeting=await s.create({title:title.trim(),startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+Number(minutes)*60000).toISOString(),attendeeEmails:meetingParticipants(emails.split(/[,;\n]/))});
   setMode(null);setEmails('');open(meeting.id);
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save the meeting')}finally{setBusy(false)}
 }
 async function copy(m:Meeting){try{await navigator.clipboard.writeText(`${window.location.origin}/dashboard/meetings?meeting=${m.id}`);setNotice('Meeting link copied. Only the organizer and invited workspace members can join.')}catch{setError('Could not copy. You can copy the meeting URL from your address bar.')}}
 async function cancel(m:Meeting){setBusy(true);setError('');try{const result=await s.cancel(m.id);setNotice(result.callEnded?'Meeting cancelled.':'Meeting cancelled. Existing calls may still be connected; ask participants to leave.')}catch(cause){setError(cause instanceof Error?cause.message:'Unable to cancel')}finally{setBusy(false)}}
 if(callId===selected&&selectedMeeting)return <main className="meetings-room-page"><div className="meetings-room-heading"><h1>{selectedMeeting.title}</h1><span>Meeting chat stays in this call.</span></div><CallRoom name={p.session?.user.email||'Workspace member'} getConnection={()=>s.connect(selectedMeeting.id)} onLeave={()=>{setCallId(null);setNotice('You left the meeting.')}}/></main>;
 return <main className="quiet-page meetings-page">
  <header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Home</Link><InboxLink/></nav></header>
  <section className="meetings-content" aria-labelledby="meetings-title">
   <div className="meetings-heading"><div><h1 id="meetings-title">Meetings</h1><p>Make time to talk.</p></div><div className="meetings-actions"><button className="meeting-button secondary" onClick={()=>begin('schedule')}><Plus size={16}/> Schedule</button><button className="meeting-button primary" onClick={()=>begin('now')}><Video size={16}/> Meet now</button></div></div>
   {s.preview&&<p className="meeting-setup-note">Local preview · Meetings are saved on this device. Connect a workspace to invite people and enable calls.</p>}
   {!s.preview&&!s.loading&&!s.callingEnabled&&!s.error&&<p className="meeting-setup-note">You can schedule meetings. Video calls will be available once calling is connected.</p>}
   {(error||s.error)&&<div className="meeting-error" role="alert">{error||s.error}{s.error&&<button onClick={()=>void s.refresh()}>Retry</button>}</div>}
   {notice&&<p className="meeting-notice" role="status">{notice}</p>}
   {mode?<form className="meeting-editor" onSubmit={create}>
    <div className="meeting-section-head"><h2>{mode==='now'?'Start a meeting':'Schedule a meeting'}</h2><button className="meeting-icon-button" type="button" aria-label="Close meeting form" disabled={busy} onClick={()=>setMode(null)}><X size={18}/></button></div>
    <label>Meeting title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required placeholder="Weekly check-in" autoFocus/></label>
    <div className="meeting-form-row">{mode==='schedule'&&<label>Date and time<input aria-label="Date and time" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} required/><span>Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></label>}<label>Duration<select aria-label="Duration" value={minutes} onChange={e=>setMinutes(e.target.value)}>{[15,30,45,60,90,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label></div>
    <label><span className="meeting-label-head">Invite people <small>optional</small></span><textarea aria-label="Invite people" value={emails} onChange={e=>setEmails(e.target.value)} placeholder="member@example.com, another@example.com" rows={2} disabled={s.preview}/><span>{s.preview?'Invitations are available in a connected workspace.':'Use email addresses of existing workspace members. They’ll see the meeting in Meetings and Upcoming.'}</span></label>
    <div className="meeting-editor-footer"><p>Up to 16 people. No recording.</p><button type="submit" className="meeting-button primary" disabled={busy}>{busy?'Saving…':mode==='now'?'Create meeting':'Schedule meeting'}<ArrowUpRight size={16}/></button></div>
   </form>:selected?<section className="meeting-detail">
    <button className="meeting-back" onClick={()=>router.push('/dashboard/meetings')}><ArrowLeft size={15}/> All meetings</button>
    {s.loading&&!selectedMeeting?<p role="status">Loading meeting…</p>:!selectedMeeting?<p>Meeting not found. Check the link and make sure you’re invited to this workspace.</p>:<>
     <h2>{selectedMeeting.title}</h2><p className="meeting-detail-time"><CalendarDays size={16}/>{dateTime(selectedMeeting.startsAt)} <span>· {duration(selectedMeeting)} min</span></p>
     <dl className="meeting-facts"><div><dt>Access</dt><dd>Organizer and invited workspace members</dd></div><div><dt>People</dt><dd>{selectedMeeting.attendeeIds.length+1} invited, including organizer</dd></div><div><dt>Status</dt><dd>{selectedMeeting.status==='cancelled'?'Cancelled':Date.parse(selectedMeeting.endsAt)<=now?'Ended':canJoinMeeting(selectedMeeting,now)?'Open to join':'Scheduled'}</dd></div></dl>
     {!s.callingEnabled&&<div className="meeting-unavailable"><Video size={20}/><div><h3>Calling isn’t connected yet</h3><p>This meeting is saved. Camera, audio, screen sharing, and chat will work once LiveKit is configured.</p></div></div>}
     <div className="meeting-detail-actions"><button className="meeting-button primary" disabled={!s.callingEnabled||!canJoinMeeting(selectedMeeting,now)} onClick={()=>setCallId(selectedMeeting.id)}><Video size={16}/> Join meeting</button><button className="meeting-button secondary" onClick={()=>void copy(selectedMeeting)}><Copy size={16}/> Copy link</button>{selectedMeeting.organizerId===s.userId&&selectedMeeting.status==='scheduled'&&<button className="meeting-text-button" disabled={busy} onClick={()=>void cancel(selectedMeeting)}>Cancel meeting</button>}</div>
     {selectedMeeting.status==='scheduled'&&!canJoinMeeting(selectedMeeting,now)&&Date.parse(selectedMeeting.endsAt)>now&&<p className="meeting-help">Join opens 15 minutes before the start. Camera and microphone are off until you enable them.</p>}
    </>}
   </section>:<>
    <div className="meeting-section-head"><h2>Upcoming</h2><span>{upcoming.length} meeting{upcoming.length===1?'':'s'}</span></div>
    {s.loading?<p className="meeting-empty" role="status">Loading meetings…</p>:!upcoming.length?<div className="meeting-empty"><CalendarDays size={24}/><h3>Your schedule is clear</h3><p>Start a quick call or schedule time with your workspace.</p><button className="meeting-text-button" onClick={()=>begin('schedule')}>Schedule your first meeting <ArrowUpRight size={15}/></button></div>:<div className="meeting-agenda">{upcoming.map(m=><button className="meeting-agenda-row" key={m.id} onClick={()=>open(m.id)}><span className="meeting-date"><b>{new Date(m.startsAt).toLocaleDateString(undefined,{day:'2-digit'})}</b><span>{new Date(m.startsAt).toLocaleDateString(undefined,{month:'short'})}</span></span><span className="meeting-row-main"><strong>{m.title}</strong><span><Clock size={14}/>{new Date(m.startsAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · {duration(m)} min · {m.organizerId===s.userId?'You organize': 'Invited'}</span></span><span className="meeting-row-action">{canJoinMeeting(m,now)?'Open meeting':'View details'}<ArrowUpRight size={16}/></span></button>)}</div>}
    {previous.length>0&&<details className="meeting-history"><summary>Past and cancelled meetings <span>{previous.length}</span></summary>{previous.map(m=><button key={m.id} onClick={()=>open(m.id)}><strong>{m.title}</strong><span>{dateTime(m.startsAt)} · {m.status==='cancelled'?'Cancelled':'Ended'}</span><ArrowUpRight size={16}/></button>)}</details>}
   </>}
  </section>
 </main>;
}
