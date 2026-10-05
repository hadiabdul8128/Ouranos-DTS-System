'use client';
import {Check,CornerUpLeft,Send,X,type LucideIcon} from 'lucide-react';
import {approvalUpdateNoticeSchema,approvalUpdateSummary} from '@/packages/contracts/approval-chain';
import {authorizationNoticeSchema} from '@/packages/contracts/authorization-notice';
import type {Entity} from '@/packages/contracts';

type Kind='submitted'|'approved'|'changes_requested'|'rejected'|'update';
const ICONS:Record<Kind,LucideIcon>={submitted:Send,approved:Check,changes_requested:CornerUpLeft,rejected:X,update:Send};
const STATUS:Record<Kind,string>={submitted:'Submitted',approved:'Approved',changes_requested:'Changes requested',rejected:'Not approved',update:'Update'};

/** What a message is about, when it arrived and its one-line preview. */
export function describeMessage(message:Entity){
 const notice=authorizationNoticeSchema.safeParse(message.data),decision=approvalUpdateNoticeSchema.safeParse(message.data);
 const kind:Kind=notice.success?'submitted':decision.success?decision.data.decision:'update';
 const at=notice.success?notice.data.submittedAt:decision.success?decision.data.decidedAt:message.updatedAt;
 const preview=notice.success?`${notice.data.submission.trip.destination} · Sent for review`:decision.success?`${decision.data.destination?`${decision.data.destination} · `:''}${approvalUpdateSummary(decision.data)}`:'An update about your travel request.';
 return {kind,at,preview,title:String(message.data.title||'Travel update')};
}

const startOfDay=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
/** 'Today', 'Yesterday', a weekday within the last week, then the date. */
export function dayLabel(at:Date,now:Date){
 const days=Math.round((startOfDay(now)-startOfDay(at))/86_400_000);
 if(days<=0)return 'Today';
 if(days===1)return 'Yesterday';
 if(days<7)return at.toLocaleDateString('en-US',{weekday:'long'});
 return at.toLocaleDateString('en-US',{month:'short',day:'numeric',...(at.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
}

export function MessageList({messages,selectedId,busy,onOpen,now}:{messages:Entity[];selectedId:string|null;busy:boolean;onOpen:(message:Entity)=>void;now:Date}){
 const groups:Array<{label:string;items:Array<{message:Entity;info:ReturnType<typeof describeMessage>}>}>=[];
 for(const message of messages){
  const info=describeMessage(message),label=dayLabel(new Date(info.at),now);
  const last=groups.at(-1);
  if(last?.label===label)last.items.push({message,info});else groups.push({label,items:[{message,info}]});
 }
 return <nav className="inbox-list" aria-label="Inbox messages">{groups.map(group=><section key={group.label} className="inbox-day" aria-label={group.label}>
  <h2 className="inbox-day-label">{group.label}</h2>
  {group.items.map(({message,info})=>{const Icon=ICONS[info.kind],unread=message.status==='unread';return <button key={message.id} type="button" className={`inbox-message-row ${unread?'is-unread':''}`} aria-current={selectedId===message.id?'true':undefined} disabled={busy} onClick={()=>onOpen(message)}>
   <span className={`inbox-row-icon is-${info.kind}`} aria-hidden="true"><Icon size={16}/></span>
   <strong>{info.title}{unread&&<span className="inbox-unread-dot" aria-label="Unread"/>}</strong>
   <time dateTime={info.at}>{new Date(info.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</time>
   <span className="inbox-preview"><span className="inbox-row-status">{STATUS[info.kind]}</span>{info.preview}</span>
  </button>})}
 </section>)}</nav>;
}
