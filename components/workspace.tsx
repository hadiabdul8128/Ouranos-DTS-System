"use client";
import {InboxLink} from '@/components/inbox/inbox-link';
import {useRouter} from 'next/navigation';
import {HomeActions} from '@/components/home-actions';
import Link from 'next/link';
import { ServiceCloud } from '@/components/service-cloud';

import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarDays } from "lucide-react";
import { UpcomingPanel, useUpcoming } from "@/components/planner/upcoming-panel";

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
    <header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><Sheet><SheetTrigger className="home-upcoming-button" aria-label={`Upcoming${upcoming.soon?`, ${upcoming.soon} this week`:""}`}><CalendarDays size={16}/> Upcoming{upcoming.soon>0&&<span>{upcoming.soon}</span>}</SheetTrigger><SheetContent side="right" className="home-upcoming-sheet"><SheetTitle className="sr-only">Upcoming</SheetTitle><UpcomingPanel/></SheetContent></Sheet><InboxLink/><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={17}/></button></nav></header>
    <section className="intent-stage home-stage" aria-labelledby="intent-heading">
      <ServiceCloud />
      <h1 id="intent-heading">What do you want to do?</h1>
      <HomeActions/>
    </section>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
