'use client';
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
 return <AppleSpotlight inline showResults={false} resolveRequest={workspaceIntent} onNavigate={onNavigate}
  shortcuts={actions.slice(0,4).map(({name,href,Icon})=>({label:name,link:href,icon:<Icon aria-hidden="true"/>}))}
 />;
}
