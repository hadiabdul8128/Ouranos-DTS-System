"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Workspace() {
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
          window.location.assign("/dashboard/travel");
          return {status: "navigation_started", destination: "/dashboard/travel"};
        },
      }, {signal: lifecycle.signal})).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!text) return;
    if (/\b(travel(?:ing|ling)?|trip|trips|dts|flight|flights|voucher|reimbursement|tdy)\b/i.test(text) && !/\b(don't|do not|not|no|cancel)\b/i.test(text)) {
      setOpening(true);
      window.location.assign("/dashboard/travel");
    } else {
      setMessage("Travel is available now. Other workflows are on the way.");
    }
  }
  return <main className="quiet-page prompt-page">
    <header className="quiet-header"><a href="/dashboard" className="quiet-brand">Ouranos</a><a href="/" className="exit-link" aria-label="Return to login"><LogOut size={17}/></a></header>
    <section className="intent-stage" aria-labelledby="intent-heading">
      <h1 id="intent-heading">What do you want to do?</h1>
      <form className="intent-input" onSubmit={submit}>
        <Input aria-label="What do you want to do?" placeholder="Tell us what you need…" value={request} onChange={event => {setRequest(event.target.value); setMessage("");}} autoComplete="off" maxLength={500} disabled={opening}/>
        <Button type="submit" aria-label="Continue with your request" className="intent-submit" disabled={!request.trim() || opening}><ArrowRight size={20}/></Button>
      </form>
      <p className={`intent-hint ${message ? "has-message" : ""}`} role="status">{opening ? "Opening travel…" : message || 'Try “I need to travel”.'}</p>
    </section>
    <footer className="quiet-footer"><span/><span>Preview</span></footer>
  </main>;
}
