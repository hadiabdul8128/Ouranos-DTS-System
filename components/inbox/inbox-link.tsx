"use client";
import {useId,useRef,useState} from 'react';
import Link from 'next/link';
import {Check,CornerUpLeft,Send,X} from 'lucide-react';
import {Inbox} from 'lucide-react';
import {useLiveQuery} from 'dexie-react-hooks';
import {usePlatform} from '@/components/platform/provider';
import {Popover,PopoverAnchor,PopoverContent} from '@/components/ui/popover';
import {NotificationsMenu} from '@/components/ui/notifications-menu';
import {inboxMessages} from '@/packages/contracts/authorization-notice';
import {describeMessage} from './message-list';
import {inboxMessageHref} from './inbox-focus';
import './inbox.css';
import './inbox-popover.css';
export function InboxLink(){const p=usePlatform();return <InboxPopup key={`${p.organizationId}:${p.session?.user.id}`}/>}
function InboxPopup(){
 const p=usePlatform(),[open,setOpen]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),trigger=useRef<HTMLAnchorElement>(null);
 const messages=useLiveQuery(async()=>inboxMessages((await p.repository?.db.entities.where('kind').equals('notification').toArray()||[]).map(r=>r.local),p.organizationId,p.session?.user.id),[p.repository,p.organizationId,p.session?.user.id]);
 const panelId=useId();
 const count=messages?.filter(n=>n.status==='unread').length||0;
 const icons={submitted:Send,approved:Check,changes_requested:CornerUpLeft,rejected:X,update:Send};
 const notifications=(messages||[]).map(message=>{const info=describeMessage(message),Icon=icons[info.kind];return {id:message.id,title:info.title,preview:info.preview,timestamp:info.at,isRead:message.status!=='unread',href:inboxMessageHref(message.id),icon:<Icon size={16} aria-hidden="true"/>}});
 async function refresh(){setRefreshing(true);setError('');try{await p.engine?.sync()}catch{setError('Unable to refresh your inbox. Try again.')}finally{setRefreshing(false)}}
 return <Popover open={open} onOpenChange={setOpen}><PopoverAnchor asChild><Link ref={trigger} href="/dashboard/inbox" className="inbox-link" aria-label={`Inbox${count?`, ${count} unread messages`:''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?panelId:undefined} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();setOpen(value=>!value)}}><Inbox size={16} aria-hidden="true"/><span>Inbox</span>{!!count&&<span className="inbox-count" aria-hidden="true">{count>99?'99+':count}</span>}</Link></PopoverAnchor><PopoverContent align="end" sideOffset={12} collisionPadding={12} id={panelId} className="inbox-popover" aria-label="Inbox" onInteractOutside={e=>{if(trigger.current?.contains(e.target as Node))e.preventDefault()}} onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus()}}><NotificationsMenu notifications={notifications} loading={messages===undefined} refreshing={refreshing} canRefresh={!!p.engine} error={error} offline={p.sync.state==='offline'} onRefresh={()=>void refresh()} onClose={()=>setOpen(false)}/></PopoverContent></Popover>;
}
