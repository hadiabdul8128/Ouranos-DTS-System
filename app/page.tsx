"use client";

import { browserAuth, platformConfigured } from "@/lib/platform/browser";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { TargetingUI } from "@/components/ui/animated-hud-targeting-ui";
import { AnimatePresence, motion } from "framer-motion";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!platformConfigured()) { window.location.assign("/dashboard"); return; }
    setBusy(true);setMessage("");
    const {error} = await browserAuth()!.auth.signInWithOtp({email, options:{emailRedirectTo:window.location.origin+"/auth/callback",shouldCreateUser:true}});
    setMessage(error ? error.message : "Check your email for a sign-in link. You can close this tab after opening it.");setBusy(false);
  }
  const [revealed, setRevealed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(preference.matches);
    const timer = window.setTimeout(() => setRevealed(true), preference.matches ? 0 : 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className={`quiet-page login-page ${revealed ? "is-revealed" : "is-intro"}`}>
    <header style={{position:"absolute",top:32,left:"clamp(24px, 4vw, 48px)",zIndex:3}}>
      <a href="/" className="quiet-brand" aria-label="Ouranos home">Ouranos</a>
    </header>
    <AnimatePresence>
      {!revealed && !reduceMotion && <motion.div key="hud-intro" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,scale:1.04}} transition={{duration:.35}} style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}>
        <TargetingUI className="opening-hud" />
      </motion.div>}
    </AnimatePresence>
    {!revealed && <button type="button" onClick={()=>setRevealed(true)} style={{position:"absolute",bottom:72,background:"transparent",border:0,color:"#aaa",fontSize:12,padding:12}}>Skip intro</button>}
    <section className="gateway" aria-label="Ouranos sign in">
      <h1 className="sr-only">Sign in to Ouranos</h1>
      <div className="login-reveal" inert={!revealed} aria-hidden={!revealed}>
        <div className="email-card">
          <form onSubmit={signIn}>
            <label htmlFor="email">Email</label>
            <Input id="email" type="email" placeholder="you@organization.com" autoComplete="email" required autoCapitalize="none" spellCheck={false} value={email} onChange={event=>setEmail(event.target.value)}/>
            <Button type="submit" className="continue-button" disabled={busy}>{busy ? "Sending link…" : "Continue"} <ArrowRight size={16}/></Button>
            {message && <p className="auth-message" role="status">{message}</p>}
          </form>
          {!reduceMotion && <div className="beam-wrapper"><BorderBeam duration={12} size={75} colorFrom="#ffffff" colorTo="#666666" borderWidth={1}/></div>}
        </div>
      </div>
    </section>
    <footer className="quiet-footer login-reveal"><span>Ouranos</span><span title={platformConfigured() ? "Email sign-in through Supabase" : "Local preview; authentication not configured"}>{platformConfigured() ? "Development workspace" : "Preview"}</span></footer>
  </main>;
}
