'use client';
import Link from 'next/link';
import {Mail} from 'lucide-react';
import {useLiveQuery} from 'dexie-react-hooks';
import {usePlatform} from '@/components/platform/provider';
import {inboxMessages} from '@/packages/contracts/authorization-notice';
import './inbox.css';
export function InboxLink(){
 const p=usePlatform();
 const count=useLiveQuery(async()=>inboxMessages((await p.repository?.db.entities.where('kind').equals('notification').toArray()||[]).map(r=>r.local),p.organizationId,p.session?.user.id).filter(n=>n.status==='unread').length,[p.repository,p.organizationId,p.session?.user.id]);
 return <Link href="/dashboard/inbox" className="inbox-link" aria-label={`Inbox${count?`, ${count} unread messages`:''}`}><Mail size={17} aria-hidden="true"/><span>Inbox</span>{!!count&&<span className="inbox-count" aria-hidden="true">{count>99?'99+':count}</span>}</Link>;
}
