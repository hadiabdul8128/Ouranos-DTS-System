'use client';
import {useState} from 'react';
import {BriefcaseBusiness, CircleHelp, Inbox, Plane, Settings, Video} from 'lucide-react';
import {workspaceIntent} from '@/packages/domain/workspace-intent';
import {AppleSpotlight} from '@/components/ui/apple-spotlight';

const actions = [
 {name:'Travel', description:'Plan a trip, book a flight, or prepare a voucher', href:'/dashboard/travel', keywords:'trip flight flights voucher reimbursement tdy authorization hotel lodging', Icon:Plane},
 {name:'Meetings', description:'Schedule a meeting or start a video call', href:'/dashboard/meetings', keywords:'meet call conference video chat', Icon:Video},
 {name:'Inbox', description:'Read your messages and approval updates', href:'/dashboard/inbox', keywords:'messages notifications approval updates', Icon:Inbox},
 {name:'Settings', description:'Manage your workspace and preferences', href:'/dashboard/platform', keywords:'preferences account workspace display', Icon:Settings},
 {name:'Help', description:'Find guides and answers about travel', href:'/dashboard/help', keywords:'guide guides questions support', Icon:CircleHelp},
 {name:'Career transition', description:'Explore your next steps after the military', href:'/dashboard/transition', keywords:'civilian jobs veteran careers', Icon:BriefcaseBusiness},
] as const;

export function WorkspaceSearch({onNavigate}:{onNavigate:(href:string)=>void}) {
 const [query,setQuery]=useState('');
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const intent=workspaceIntent(query);
 const matches=actions.filter(action=>!words.length||intent===action.href||words.every(word=>`${action.name} ${action.description} ${action.keywords}`.toLowerCase().includes(word)));
 return <AppleSpotlight inline onNavigate={onNavigate} onSearchValueChange={setQuery}
  shortcuts={actions.slice(0,4).map(({name,href,Icon})=>({label:name,link:href,icon:<Icon aria-hidden="true"/>}))}
  searchResults={matches.map(({name,description,href,Icon})=>({label:name,description,link:href,icon:<Icon aria-hidden="true"/>}))}/>;
}
