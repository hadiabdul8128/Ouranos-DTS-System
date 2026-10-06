"use client";
import {InboxLink} from '@/components/inbox/inbox-link';
import {useRouter} from 'next/navigation';
import {workspaceIntent} from '@/packages/domain/workspace-intent';
import Link from 'next/link';
import { ServiceCloud } from '@/components/service-cloud';

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, LogOut, Settings } from "lucide-react";
import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarDays } from "lucide-react";
import { UpcomingPanel, useUpcoming } from "@/components/planner/upcoming-panel";
import { TypingAnimation } from "@/components/ui/typing-animation";

// Each example routes somewhere real through workspaceIntent.
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
const EXAMPLES=["Plan a trip to Fort Liberty","Book a flight to San Diego","File my travel voucher","Start a TDY to Norfolk","How do I file a voucher?"];

export default function Workspace() {
  const router=useRouter();
  const platform = usePlatform();
  const [request, setRequest] = useState("");
  const [message, setMessage] = useState("");
  const [opening, setOpening] = useState(false);
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
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!text) return;
    const destination=workspaceIntent(text);
    if(destination){setOpening(true);router.push(destination)}
    else setMessage("Try a trip, a flight or a voucher, like the examples in the box.");
  }
  return <main className="quiet-page prompt-page">
    <header className="quiet-header home-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><Sheet><SheetTrigger className="home-upcoming-button" aria-label={`Upcoming${upcoming.soon?`, ${upcoming.soon} this week`:""}`}><CalendarDays size={16}/> Upcoming{upcoming.soon>0&&<span>{upcoming.soon}</span>}</SheetTrigger><SheetContent side="right" className="home-upcoming-sheet"><SheetTitle className="sr-only">Upcoming</SheetTitle><UpcomingPanel/></SheetContent></Sheet><InboxLink/><Link href="/dashboard/platform" className="exit-link" aria-label="Settings" title="Settings"><Settings size={18} aria-hidden="true"/></Link><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={17}/></button></nav></header>
    <section className="intent-stage" aria-labelledby="intent-heading">
      <ServiceCloud />
      <h1 id="intent-heading">What do you want to do?</h1>
      <form className="intent-input" onSubmit={submit}>
        <span className="intent-field">{!request&&<span aria-hidden="true"><TypingAnimation className="intent-examples" words={EXAMPLES} delay={900}/></span>}<span id="intent-examples-help" className="sr-only">For example: {EXAMPLES.join("; ")}.</span><Input aria-label="What do you want to do?" aria-describedby="intent-examples-help" placeholder="" value={request} onChange={event => {setRequest(event.target.value); setMessage("");}} autoComplete="off" maxLength={500} disabled={opening}/></span>
        <Button type="submit" aria-label="Continue with your request" className="intent-submit" disabled={!request.trim() || opening}><ArrowRight size={20}/></Button>
      </form>
      <p className={`intent-hint ${message ? "has-message" : ""}`} role="status">{opening ? "Opening your workspace…" : message || ''}</p>
      <div className="home-links"><Link href="/dashboard/travel" className="back-link">Travel system →</Link><Link href="/dashboard/help" className="back-link">Help →</Link></div>
      <nav className="home-systems" aria-labelledby="home-systems-title">
        <h2 id="home-systems-title">Other systems</h2>
        <ul>{SYSTEMS.map(system=><li key={system.name}><a href="#" className="home-system" aria-disabled="true" onClick={event=>event.preventDefault()}><strong>{system.name}</strong><span>{system.detail}</span><ArrowUpRight size={15} aria-hidden="true"/></a></li>)}</ul>
      </nav>
    </section>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
