"use client";
import {InboxLink} from '@/components/inbox/inbox-link';
import {useRouter} from 'next/navigation';
import {workspaceIntent} from '@/packages/domain/workspace-intent';
import Link from 'next/link';
import { ServiceCloud } from '@/components/service-cloud';

import { useEffect, useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarDays } from "lucide-react";
import { UpcomingPanel } from "@/components/planner/upcoming-panel";

export default function Workspace() {
  const router=useRouter();
  const platform = usePlatform();
  const [request, setRequest] = useState("");
  const [message, setMessage] = useState("");
  const [opening, setOpening] = useState(false);
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
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!text) return;
    const destination=workspaceIntent(text);
    // Anything else becomes a checklist the traveler can work through and ask about.
    setOpening(true);router.push(destination??`/dashboard/guide?q=${encodeURIComponent(text)}`);
  }
  return <main className="quiet-page prompt-page">
    <header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><Sheet><SheetTrigger className="home-upcoming-button"><CalendarDays size={16}/> Upcoming</SheetTrigger><SheetContent side="right" className="home-upcoming-sheet"><SheetTitle className="sr-only">Upcoming</SheetTitle><UpcomingPanel/></SheetContent></Sheet><InboxLink/><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={17}/></button></nav></header>
    <div className="home-body">
    <section className="intent-stage" aria-labelledby="intent-heading">
      <ServiceCloud />
      <h1 id="intent-heading">What do you want to do?</h1>
      <form className="intent-input" onSubmit={submit}>
        <Input aria-label="What do you want to do?" placeholder="Plan a trip, or tell us a task like “prepare for deployment”…" value={request} onChange={event => {setRequest(event.target.value); setMessage("");}} autoComplete="off" maxLength={500} disabled={opening}/>
        <Button type="submit" aria-label="Continue with your request" className="intent-submit" disabled={!request.trim() || opening}><ArrowRight size={20}/></Button>
      </form>
      <p className={`intent-hint ${message ? "has-message" : ""}`} role="status">{opening ? "Opening your workspace…" : message || ''}</p>
      <nav className="home-links" aria-label="Shortcuts"><Link href="/dashboard/travel" className="back-link">Travel system →</Link><Link href="/dashboard/guide" className="back-link">Checklists →</Link></nav>
    </section>
    <aside className="home-side" aria-label="Upcoming"><UpcomingPanel/></aside>
    </div>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
