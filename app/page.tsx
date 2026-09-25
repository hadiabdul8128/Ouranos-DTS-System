"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Fingerprint, Orbit, ShieldCheck } from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [notice, setNotice] = useState(false);
  return <main className="login-shell">
    <header className="login-header"><a href="/" className="brand"><Orbit size={29}/><span>ouranos<span className="brand-dot">.</span></span></a><span className="eyebrow">OPERATIONS, CONNECTED.</span></header>
    <section className="login-story"><div className="chapter"><span/> YOUR MISSION. LESS FRICTION.</div><h1>Focus on the work.<br/><span>We’ll connect <br/>the rest.</span></h1><p>One workspace for the work ahead.<br/>Start with travel. Stay connected to every step.</p><div className="story-footer"><span>01 — TRAVEL OPERATIONS</span><ArrowUpRight size={21}/></div></section>
    <section className="login-side"><div className="login-card"><div className="login-icon"><Fingerprint size={27}/></div><div className="eyebrow">YOUR OPERATIONAL WORKSPACE</div><h2>Welcome to Ouranos.</h2><p>Your next mission starts here.</p><form action="/dashboard"><label htmlFor="email">Workspace email</label><Input id="email" type="email" placeholder="you@organization.mil" autoComplete="email"/><Button type="submit" className="login-submit">Continue to workspace <ArrowRight size={16}/></Button></form><div className="login-divider"><span>OR</span></div><Button variant="outline" className="cac-button" onClick={()=>setNotice(!notice)}><ShieldCheck size={17}/> Sign in with CAC / PIV</Button>{notice && <p className="auth-notice" role="status">CAC / PIV sign-in will be available when your organization’s identity provider is connected. Use the demo workspace above for now.</p>}<p className="prototype-note">Interactive prototype · no credentials required</p><div className="beam-wrapper"><BorderBeam size={110} duration={9} colorFrom="#a7caff" colorTo="#527ff5" borderWidth={1.5}/></div></div><p className="login-caption">From the first action to the final record.</p></section>
    <footer className="login-footer"><span>© 2026 Ouranos</span><span>DESIGNED FOR THE WORK THAT MATTERS</span><span>PRODUCT PREVIEW <span className="status-dot"/></span></footer>
  </main>;
}
