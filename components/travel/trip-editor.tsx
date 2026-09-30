'use client';
import {useState} from 'react';
import {Pencil} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {PlaceField} from './place-field';
import {PurposeField} from './purpose-field';
import {localToday} from '@/packages/domain/flight-search';
import type {Entity} from '@/packages/contracts';
import './trip-editor.css';

const text=(value:unknown)=>typeof value==='string'?value:'';
const day=(value:string)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'';

/** Trip dates with a way to change the destination, dates or purpose until the plan is submitted. */
export function TripEditor({trip,editable}:{trip:Entity;editable:boolean}){
 const p=usePlatform();
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState({destination:'',departure:'',returnDate:'',purpose:''}),[today]=useState(localToday);
 function start(){setDraft({destination:text(trip.data.destination),departure:text(trip.data.departure),returnDate:text(trip.data.returnDate),purpose:text(trip.data.purpose)});setError('');setEditing(true)}
 async function save(e:React.FormEvent){
  e.preventDefault();if(busy)return;setError('');
  if(!draft.destination){setError('Choose the destination city and state.');return}
  if(draft.departure<today&&draft.departure!==trip.data.departure){setError('Departure can’t be in the past.');return}
  if(draft.returnDate<draft.departure){setError('Return must follow departure.');return}
  if(!p.repository){setError('Choose a workspace in Settings.');return}
  setBusy(true);
  try{await p.repository.stage('trip.save',trip.id,{destination:draft.destination.trim(),departure:draft.departure,returnDate:draft.returnDate,purpose:draft.purpose.trim(),timezone:text(trip.data.timezone)||Intl.DateTimeFormat().resolvedOptions().timeZone});await p.engine?.sync();setEditing(false)}
  catch(err){setError(err instanceof Error?err.message:'Unable to save the trip.')}
  finally{setBusy(false)}
 }
 if(!editing)return <div className="trip-summary"><p className="cw-muted">{day(text(trip.data.departure))} — {day(text(trip.data.returnDate))}</p>{editable&&<button type="button" className="trip-edit-link" onClick={start}><Pencil size={13}/> Edit trip</button>}</div>;
 return <form className="trip-editor" onSubmit={save} aria-label="Edit trip">
  <PlaceField id="trip-destination" label="Destination" value={draft.destination} onChange={destination=>setDraft(d=>({...d,destination}))}/>
  <div className="travel-date-fields"><div className="travel-field"><label htmlFor="trip-departure">Departure</label><Input type="date" id="trip-departure" min={draft.departure<today?draft.departure:today} value={draft.departure} onChange={e=>setDraft(d=>({...d,departure:e.target.value}))} required/></div><div className="travel-field"><label htmlFor="trip-return">Return</label><Input type="date" id="trip-return" min={draft.departure} value={draft.returnDate} onChange={e=>setDraft(d=>({...d,returnDate:e.target.value}))} required/></div></div>
  <PurposeField value={draft.purpose} onChange={purpose=>setDraft(d=>({...d,purpose}))}/>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <div className="trip-editor-actions"><Button type="button" variant="outline" onClick={()=>setEditing(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save trip'}</Button></div>
 </form>;
}
