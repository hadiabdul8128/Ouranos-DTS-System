"use client";

import { SyncIndicator, usePlatform } from "@/components/platform/provider";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TravelRequest() {
  const platform = usePlatform();
  const [saving, setSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState('');
  const [stage, setStage] = useState<"details" | "review" | "saved">("details");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!destination.trim() || !purpose.trim()) {setError("Add a destination and a purpose for your trip."); return;}
    if (returnDate < departure) {setError("Your return date must be on or after your departure."); return;}
    setError(""); setStage("review");
  }
  async function save() {
    if (!platform.repository) {setError("Open workspace settings to create or select an organization first."); return;}
    setSaving(true);
    try {
      const tripId=crypto.randomUUID();
      await platform.repository.stage('trip.save', tripId, {destination:destination.trim(),departure,returnDate,purpose:purpose.trim(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      setSavedTripId(tripId);setError("");setStage("saved");void platform.engine?.sync();
    } catch (e) {setError(e instanceof Error ? e.message : "Your device could not save this draft. Please try again.");}
    finally {setSaving(false);}
  }
  const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
  return <main className="quiet-page travel-page">
    <header className="quiet-header"><a href="/dashboard" className="quiet-brand">Ouranos</a><button onClick={() => void platform.signOut()} className="exit-link" aria-label="Sign out"><LogOut size={17}/></button></header>
    <section className="travel-stage" aria-labelledby="travel-heading">
      <a className="back-link" href="/dashboard"><ArrowLeft size={14}/> Back</a>
      {stage === "saved" ? <div className="saved-state"><div className="saved-mark"><Check size={23}/></div><h1 id="travel-heading">Draft saved.</h1><p>{destination}</p><p className="saved-dates">{formatDate(departure)} — {formatDate(returnDate)}</p><div className="saved-note">Saved on this device. DTS is not connected.</div><Button asChild className="continue-button"><a href={`/dashboard/travel/planning?tripId=${savedTripId}`}>Continue to travel plan <ArrowRight size={16}/></a></Button></div> : <>
        <div className="travel-eyebrow">TRAVEL <span/> DTS</div>
        <h1 id="travel-heading">{stage === "details" ? "Let’s plan your travel." : "Everything look right?"}</h1>
        <p className="travel-subtitle">{stage === "details" ? "Start with the essentials." : "Review the details before saving your draft."}</p>
        {stage === "details" ? <form className="travel-form" onSubmit={review}>
          <div className="travel-field"><label htmlFor="destination">Where are you going?</label><Input id="destination" placeholder="City or installation" value={destination} onChange={event => setDestination(event.target.value)} required maxLength={120}/></div>
          <div className="travel-date-fields"><div className="travel-field"><label htmlFor="departure">Departure</label><Input id="departure" type="date" value={departure} onChange={event => setDeparture(event.target.value)} required/></div><div className="travel-field"><label htmlFor="return">Return</label><Input id="return" type="date" min={departure} value={returnDate} onChange={event => setReturnDate(event.target.value)} required/></div></div>
          <div className="travel-field"><label htmlFor="purpose">Purpose of travel</label><Input id="purpose" placeholder="What is this trip for?" value={purpose} onChange={event => setPurpose(event.target.value)} required maxLength={250}/></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="continue-button">Continue <ArrowRight size={16}/></Button>
        </form> : <div className="travel-review"><dl><div><dt>Destination</dt><dd>{destination}</dd></div><div><dt>Departure</dt><dd>{formatDate(departure)}</dd></div><div><dt>Return</dt><dd>{formatDate(returnDate)}</dd></div><div><dt>Purpose</dt><dd>{purpose}</dd></div></dl><p className="review-note">Your draft saves on this device and syncs with Ouranos when connected. Nothing is submitted to DTS.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="review-actions"><Button variant="ghost" onClick={() => {setError(""); setStage("details");}}>Edit details</Button><Button className="continue-button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save draft"} <ArrowRight size={16}/></Button></div></div>}
      </>}
    </section>
    <footer className="quiet-footer"><span/><SyncIndicator/></footer>
  </main>;
}
