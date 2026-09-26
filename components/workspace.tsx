"use client";
import {useRouter} from 'next/navigation';
import {workspaceIntent} from '@/packages/domain/workspace-intent';
import Link from 'next/link';

import { useEffect, useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    if(destination){setOpening(true);router.push(destination)}
    else setMessage("You can plan travel, organize your money, or explore life after the military.");
  }
  return <main className="quiet-page prompt-page">
    <header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={17}/></button></header>
    <section className="intent-stage" aria-labelledby="intent-heading">
      <h1 id="intent-heading">What do you want to do?</h1>
      <form className="intent-input" onSubmit={submit}>
        <Input aria-label="What do you want to do?" placeholder="Tell us what you need…" value={request} onChange={event => {setRequest(event.target.value); setMessage("");}} autoComplete="off" maxLength={500} disabled={opening}/>
        <Button type="submit" aria-label="Continue with your request" className="intent-submit" disabled={!request.trim() || opening}><ArrowRight size={20}/></Button>
      </form>
      <p className={`intent-hint ${message ? "has-message" : ""}`} role="status">{opening ? "Opening your workspace…" : message || ''}</p>
      <nav aria-label="Available workflows" className="flex flex-wrap justify-center gap-x-8 gap-y-3">
        <Link href="/dashboard/financial-readiness" className="back-link">Plan my finances →</Link>
        <Link href="/dashboard/transition" className="back-link">Plan life after the military →</Link>
      </nav>
    </section>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
