'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import type {DateRange} from 'react-day-picker';
import {Calendar} from '@/components/ui/calendar';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import './trip-dates-field.css';

const toDate=(value:string)=>value?new Date(`${value}T12:00:00`):undefined;
const toValue=(date?:Date)=>date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';
const show=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
const nightsBetween=(from:string,to:string)=>Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86_400_000);

/** Departure and return as one range: pick both on a calendar and see the nights and per diem days. */
export function TripDatesField({departure,returnDate,today,onChange,hint}:{departure:string;returnDate:string;today:string;onChange:(departure:string,returnDate:string)=>void;hint?:string}){
 const [open,setOpen]=useState(false),[months,setMonths]=useState(2),field=useRef<HTMLDivElement>(null);
 // Opening scrolls the field near the top so the calendar fits underneath it.
 function toggle(next:boolean){if(next)field.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setOpen(next)}
 useEffect(()=>{const query=window.matchMedia('(max-width: 640px)');const sync=()=>setMonths(query.matches?1:2);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync)},[]);
 const nights=departure&&returnDate&&returnDate>=departure?nightsBetween(departure,returnDate):null;
 const summary=nights===null?'':`${nights} ${nights===1?'night':'nights'} · ${nights+1} ${nights===0?'day':'days'}`;
 function select(range:DateRange|undefined){
  const from=toValue(range?.from),to=toValue(range?.to);
  onChange(from,to&&to!==from?to:'');
  if(from&&to&&to!==from)setOpen(false);
 }
 return <div className="trip-dates" ref={field}>
  <span className="trip-dates-label" id="trip-dates-label">Travel dates</span>
  <Popover open={open} onOpenChange={toggle}>
   <PopoverTrigger asChild>
    <button type="button" className="trip-dates-trigger" aria-labelledby="trip-dates-label" aria-describedby="trip-dates-value" aria-haspopup="dialog">
     <span className="trip-dates-part"><small>Departure</small><strong>{departure?show(departure):'Pick a date'}</strong></span>
     <span className="trip-dates-arrow" aria-hidden="true">→</span>
     <span className="trip-dates-part"><small>Return</small><strong className={returnDate?'':'is-empty'}>{returnDate?show(returnDate):departure?'Pick a date':'—'}</strong></span>
     <CalendarDays className="trip-dates-icon" size={18} aria-hidden="true"/>
    </button>
   </PopoverTrigger>
   <PopoverContent className="trip-dates-popover" side="bottom" align="start" sideOffset={8} collisionPadding={12}>
    <p className="trip-dates-step" role="status">{!departure?'Pick your departure date':!returnDate?'Now pick your return date':summary}</p>
    <Calendar mode="range" className="trip-dates-calendar" numberOfMonths={months} resetOnSelect excludeDisabled disabled={{before:toDate(today)!}} defaultMonth={toDate(departure)??toDate(today)} selected={{from:toDate(departure),to:toDate(returnDate)}} onSelect={select}/>
    <div className="trip-dates-actions">
     <button type="button" className="trip-dates-clear" onClick={()=>onChange('','')} disabled={!departure}>Clear</button>
     <button type="button" className="trip-dates-done" onClick={()=>setOpen(false)}>Done</button>
    </div>
   </PopoverContent>
  </Popover>
  <span className="trip-dates-summary" id="trip-dates-value" aria-live="polite" hidden={!summary}>{summary}</span>
  {hint&&<small className="place-hint trip-dates-hint">{hint}</small>}
 </div>;
}
