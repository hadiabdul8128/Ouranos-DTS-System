"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, MessageCircle, Send, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlatform } from "@/components/platform/provider";
import "./companion.css";

export function Companion() {
  const platform = usePlatform();
  return <CompanionPanel key={`${platform.organizationId}:${platform.session?.user.id}`} />;
}

function CompanionPanel() {
  const platform = usePlatform();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  useEffect(() => {log.current?.scrollTo({top:log.current.scrollHeight});}, [messages,busy]);
  async function ask(event:React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || inFlight.current || !platform.client || !platform.organizationId) return;
    const controller = new AbortController(); inFlight.current = controller;
    const next = [...messages.slice(-8), {role:'user' as const,content:question.trim()}];
    setBusy(true); setError("");
    try {
      const result = await platform.client.request<{answer:string}>('/v1/companion/chat',{method:'POST',body:JSON.stringify({organizationId:platform.organizationId,messages:next}),signal:controller.signal});
      if(!controller.signal.aborted){setMessages([...next,{role:'assistant',content:result.answer}]);setQuestion("");}
    } catch (error) {if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Unable to connect. Please try again.');}
    finally {if(!controller.signal.aborted)setBusy(false);inFlight.current=null;}
  }
  const rows = useLiveQuery(async () => {
    const records = await platform.repository?.db.entities.toArray();
    return records?.map(record => record.local).filter(entity => entity.organizationId === platform.organizationId) ?? [];
  }, [platform.repository, platform.organizationId]);
  const tasks = (rows ?? []).filter(entity =>
    (entity.kind === "authorization" && ["draft", "changes_requested"].includes(entity.status)) ||
    (entity.kind === "voucher" && ["draft", "needs_action", "changes_requested"].includes(entity.status))
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <aside className="companion" aria-label="Ouranos companion">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="companion-launcher" aria-label="Open Ouranos companion" title="Your companion">
          <Image src="/companion/robot-dog.png" alt="" width={144} height={144} sizes="(max-width: 600px) 88px, 112px" />
          <span className="companion-chat-mark" aria-hidden="true"><MessageCircle size={13}/></span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="companion-panel" side="top" align="end" sideOffset={8} collisionPadding={16} aria-labelledby="companion-title">
        <header><h2 id="companion-title">Your companion</h2><button aria-label="Close companion" onClick={() => setOpen(false)}><X size={17}/></button></header>
        <section aria-labelledby="companion-tasks">
          <h3 id="companion-tasks">To do</h3>
          {!rows || !platform.repository ? <p role="status">Loading your workspace…</p> : tasks.length ? <ul>{tasks.slice(0, 5).map(task => {
            const trip = rows.find(row => row.kind === "trip" && row.id === task.tripId);
            const destination = typeof trip?.data.destination === "string" ? trip.data.destination : "Your trip";
            const label = task.kind === "authorization" ? (task.status === "changes_requested" ? "Update travel plan" : "Finish travel plan") : (task.status === "needs_action" || task.status === "changes_requested" ? "Review voucher" : "Finish voucher");
            return <li key={task.id}><Link href={`/dashboard/travel/${task.kind === "authorization" ? "planning" : "vouchers"}?tripId=${encodeURIComponent(task.tripId ?? "")}`} onClick={() => setOpen(false)}><span>{label}<small>{destination}</small></span><ArrowUpRight size={16}/></Link></li>;
          })}</ul> : <p>No pending drafts or changes.</p>}
          <Link className="companion-trips" href="/dashboard/travel" onClick={() => setOpen(false)}>View travel <ArrowUpRight size={14}/></Link>
        </section>
        <div className="companion-messages" ref={log} role="log" aria-label="Chat messages" aria-live="polite">
          {messages.map((message,index)=><p key={index} className={`companion-message ${message.role}`}><span className="sr-only">{message.role==='user'?'You':'Companion'}: </span>{message.content}</p>)}
          {busy&&<p role="status">Thinking…</p>}
        </div>
        <form className="companion-chat-form" onSubmit={ask}>
          <label className="sr-only" htmlFor="companion-question">Ask your companion</label>
          <input id="companion-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={2000} placeholder="Ask me anything…" disabled={busy||!platform.client} autoComplete="off"/>
          <button type="submit" aria-label="Send message" disabled={busy||!question.trim()||!platform.client}><Send size={16}/></button>
        </form>
        {error&&<p role="alert" className="companion-error">{error}</p>}
        <p className="companion-disclosure">{platform.client?'AI answers use your saved travel status.':'Sign in to use AI chat.'}</p>
      </PopoverContent>
    </Popover>
  </aside>;
}
