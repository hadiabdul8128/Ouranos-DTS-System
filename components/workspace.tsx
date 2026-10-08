"use client";
import "./workspace-header.css";
import {Dock,DockItem} from "@/components/ui/dock";
import {MeetingsLink} from '@/components/meetings/meetings-link';
import {InboxLink} from '@/components/inbox/inbox-link';
import {useRouter} from 'next/navigation';
import {WorkspaceSearch} from '@/components/search/workspace-search';
import Link from 'next/link';
import { ServiceCloud } from '@/components/service-cloud';

import { useEffect } from "react";
import { CircleHelp, PanelLeft, LogOut, Settings } from "lucide-react";
import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarDays } from "lucide-react";
import { UpcomingPanel, useUpcoming } from "@/components/planner/upcoming-panel";

// Other systems service members use alongside Ouranos. Shown as links for now; they don't open anything yet.
const SYSTEMS=[
  {name:"DTS",detail:"Defense Travel System"},
  {name:"Citi Manager",detail:"Government travel card"},
  {name:"MyPay",detail:"Pay and LES"},
  {name:"DTMO",detail:"Per diem rates"},
  {name:"IPPS-A",detail:"Personnel and pay"},
  {name:"iPERMS",detail:"Personnel records"},
  {name:"Army 365",detail:"Email and Teams"},
  {name:"Military OneSource",detail:"Support, 24/7"},
];

export default function Workspace() {
  const router=useRouter();
  const platform = usePlatform();
  const upcoming = useUpcoming();
  useEffect(() => {
    const context = (document as Document & {modelContext?: {registerTool: (tool: unknown, options: {signal: AbortSignal}) => Promise<void> | void}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: "open_travel_workspace",
        description: "Open the Ouranos travel form. Does not create or submit a trip.",
        inputSchema: {type: "object", properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: false},
        execute(input: unknown) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Expected an empty object");
          router.push("/dashboard/travel");
          return {status: "navigation_started", destination: "/dashboard/travel"};
        },
      }, {signal: lifecycle.signal})).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [router]);
  return <main className="quiet-page prompt-page">
    <header className="quiet-header home-header"><div className="home-brand-actions"><Sheet><SheetTrigger className="home-systems-toggle" aria-label="Other systems" title="Other systems"><PanelLeft size={16} aria-hidden="true"/></SheetTrigger><SheetContent side="left" className="home-systems-sidebar"><SheetTitle>Other systems</SheetTitle><SheetDescription>Services you use alongside Ouranos. Links are not configured yet.</SheetDescription><nav aria-label="Other systems"><ul>{SYSTEMS.map(system=><li key={system.name}><div className="home-sidebar-system"><strong>{system.name}</strong><span>{system.detail}</span></div></li>)}</ul></nav></SheetContent></Sheet><Link href="/dashboard" className="quiet-brand">Ouranos</Link></div><Dock className="inbox-header-actions"><DockItem label="Upcoming"><Sheet><SheetTrigger className="home-upcoming-button" aria-label={`Upcoming${upcoming.soon?`, ${upcoming.soon} this week`:""}`}><CalendarDays size={16}/> <span className="home-upcoming-label">Upcoming</span>{upcoming.soon>0&&<span>{upcoming.soon}</span>}</SheetTrigger><SheetContent side="right" className="home-upcoming-sheet"><SheetTitle className="sr-only">Upcoming</SheetTitle><UpcomingPanel/></SheetContent></Sheet></DockItem><DockItem label="Meetings"><MeetingsLink/></DockItem><DockItem label="Inbox"><InboxLink/></DockItem><DockItem label="Help"><Link href="/dashboard/help" className="home-help-link" aria-label="Help" title="Help"><CircleHelp size={16} aria-hidden="true"/><span>Help</span></Link></DockItem><DockItem label="Settings"><Link href="/dashboard/platform" className="exit-link" aria-label="Settings" title="Settings"><Settings size={16} aria-hidden="true"/></Link></DockItem><DockItem label="Log out"><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={16} aria-hidden="true"/></button></DockItem></Dock></header>
    <section className="intent-stage" aria-label="Workspace search">
      <ServiceCloud />
      <WorkspaceSearch onNavigate={href=>router.push(href)}/>
    </section>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
