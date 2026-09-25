"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { HyperText } from "@/components/ui/hyper-text";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [revealed, setRevealed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(preference.matches);
    const timer = window.setTimeout(() => setRevealed(true), preference.matches ? 0 : 1300);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className={`quiet-page login-page ${revealed ? "is-revealed" : "is-intro"}`}>
    <section className="gateway" aria-label="Ouranos sign in">
      <h1 className="gateway-wordmark" aria-label="Ouranos"><span aria-hidden="true">{reduceMotion ? <span className="static-wordmark">Ouranos</span> : <HyperText className="hyper-wordmark" duration={1000} animateOnHover={false}>Ouranos</HyperText>}</span></h1>
      <div className="login-reveal" inert={!revealed} aria-hidden={!revealed}>
        <div className="email-card">
          <form onSubmit={event => { event.preventDefault(); window.location.assign("/dashboard"); }}>
            <label htmlFor="email">Email</label>
            <Input id="email" type="email" placeholder="you@organization.com" autoComplete="email" required autoCapitalize="none" spellCheck={false}/>
            <Button type="submit" className="continue-button">Continue <ArrowRight size={16}/></Button>
          </form>
          {!reduceMotion && <div className="beam-wrapper"><BorderBeam duration={12} size={75} colorFrom="#ccd5e2" colorTo="#7c97c2" borderWidth={1}/></div>}
        </div>
      </div>
    </section>
    <footer className="quiet-footer login-reveal"><span>Ouranos</span><span title="Interface preview. Email is not verified or stored.">Preview</span></footer>
  </main>;
}
