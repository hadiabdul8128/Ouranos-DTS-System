"use client";
import * as React from 'react';
import Link from 'next/link';
import {ArrowUpRight,Inbox,RefreshCw,X} from 'lucide-react';
import {Avatar,AvatarFallback} from '@/components/ui/avatar';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardHeader} from '@/components/ui/card';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {cn} from '@/lib/utils';

export type MenuNotification={id:string;title:string;preview:string;timestamp:string;isRead:boolean;href:string;icon?:React.ReactNode};
export type NotificationsMenuProps={notifications:MenuNotification[];loading?:boolean;refreshing?:boolean;canRefresh?:boolean;error?:string;offline?:boolean;onRefresh?:()=>void;onClose?:()=>void;className?:string};

/** Adapted from the supplied 21st.dev notification menu: live data, travel filters, and native page links. */
export function NotificationsMenu({notifications,loading,refreshing,canRefresh,error,offline,onRefresh,onClose,className}:NotificationsMenuProps){
 const [activeTab,setActiveTab]=React.useState('all');
 const unread=notifications.filter(n=>!n.isRead);
 const heading=React.useId();
 function list(items:MenuNotification[]){
  return <div className="notifications-menu-list">{loading?<p role="status" className="notifications-menu-empty">Loading your messages…</p>:items.length?<ul>{items.slice(0,20).map(n=><li key={n.id}><Link href={n.href} onClick={onClose} className={cn('notification-item',!n.isRead&&'is-unread')}><Avatar className="notification-avatar"><AvatarFallback>{n.icon??<Inbox size={16} aria-hidden="true"/>}</AvatarFallback></Avatar><span className="notification-copy"><span className="notification-title">{n.title}{!n.isRead&&<span className="notification-unread" aria-label="Unread"/>}</span><time dateTime={n.timestamp}>{new Date(n.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'})}</time><span className="notification-preview">{n.preview}</span></span></Link></li>)}</ul>:<div className="notifications-menu-empty"><Inbox size={24} aria-hidden="true"/><p>{activeTab==='unread'?'No unread messages.':'You’re all caught up.'}</p><span>{activeTab==='unread'?'Your other updates are in All.':'Travel confirmations and approval updates will appear here.'}</span></div>}{items.length>20&&<p className="notifications-menu-limit">Showing the latest 20. Open the full inbox for earlier messages.</p>}</div>;
 }
 return <Card className={cn('notifications-menu',className)} aria-labelledby={heading}><CardHeader><div className="notifications-menu-heading"><h2 id={heading}>Inbox</h2><div><Button type="button" variant="ghost" size="icon" aria-label="Refresh inbox" title="Refresh inbox" disabled={!canRefresh||refreshing} onClick={onRefresh}><RefreshCw size={16} className={refreshing?'animate-spin':''}/></Button><Button type="button" variant="ghost" size="icon" aria-label="Close inbox" onClick={onClose}><X size={16}/></Button></div></div><Tabs value={activeTab} onValueChange={setActiveTab}><TabsList aria-label="Inbox filter"><TabsTrigger value="all">All<Badge variant="secondary">{notifications.length}</Badge></TabsTrigger><TabsTrigger value="unread">Unread<Badge variant="secondary">{unread.length}</Badge></TabsTrigger></TabsList><CardContent>{error&&<p role="alert" className="notifications-menu-error">{error}</p>}{offline&&<p role="status" className="notifications-menu-limit">Offline · saved messages</p>}<TabsContent value="all">{list(notifications)}</TabsContent><TabsContent value="unread">{list(unread)}</TabsContent></CardContent></Tabs></CardHeader><footer className="notifications-menu-footer"><Link href="/dashboard/inbox" onClick={onClose}>Open full inbox <ArrowUpRight size={16} aria-hidden="true"/></Link></footer></Card>;
}
