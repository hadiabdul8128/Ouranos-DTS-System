'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Check,Copy} from 'lucide-react';
import type {Entity} from '@/packages/contracts';
import {planningModuleSchema} from '@/packages/contracts/planning-module';
import {authorizationSheet,voucherSheet,type SheetSection} from '@/packages/domain/dts-sheet';
import type {LocalRecord} from '@/packages/offline/database';
import './dts-sheet.css';

const text=(value:unknown)=>typeof value==='string'?value:'';
const latest=(rows:LocalRecord[],kind:string,tripId:string)=>rows.filter(r=>r.kind===kind&&r.local.tripId===tripId).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0];

/** Clipboard API first; some browsers block it, so fall back to selecting a hidden field and copying. */
async function copyText(value:string){
 try{await navigator.clipboard.writeText(value);return true}catch{/* fall back below */}
 const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
 try{return document.execCommand('copy')}catch{return false}finally{field.remove()}
}

function CopyButton({value,label}:{value:string;label:string}){
 const [state,setState]=useState<'idle'|'copied'|'selected'>('idle');
 async function copy(event:React.MouseEvent<HTMLButtonElement>){
  const shown=event.currentTarget.parentElement?.querySelector('span');
  if(await copyText(value)){setState('copied');setTimeout(()=>setState('idle'),1500);return}
  // Copying is blocked here: select the value so one keystroke copies it.
  if(shown){const range=document.createRange();range.selectNodeContents(shown);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)}
  setState('selected');setTimeout(()=>setState('idle'),4000);
 }
 return <button type="button" className="dts-copy" onClick={event=>void copy(event)} aria-label={`Copy ${label}`}>{state==='copied'?<Check size={14}/>:<Copy size={14}/>}<span>{state==='copied'?'Copied':state==='selected'?(/Mac|iPhone|iPad/.test(navigator.userAgent)?'Press ⌘C':'Press Ctrl+C'):'Copy'}</span></button>;
}

function Sections({sections}:{sections:SheetSection[]}){
 return <ol className="dts-sheet-steps">{sections.map((section,index)=><li key={section.id}>
  <div className="dts-sheet-number" aria-hidden="true">{index+1}</div>
  <div className="dts-sheet-body">
   <h2>{section.title}</h2><p className="dts-sheet-where">In DTS: {section.where}</p>
   {section.fields.length>0&&<dl>{section.fields.map(field=><div key={`${field.label}:${field.value}`}><dt>{field.label}</dt><dd><span className={field.value.length>60?'is-long':''}>{field.value}</span>{field.copy&&<CopyButton value={field.value} label={field.label}/>}</dd></div>)}</dl>}
   {section.notes.length>0&&<ul>{section.notes.map(note=><li key={note}>{note}</li>)}</ul>}
  </div>
 </li>)}</ol>;
}

/** Everything to type into DTS for this trip, in DTS's screen order, with copy buttons. */
export function DtsSheet({trip,rows}:{trip:Entity;rows:LocalRecord[]}){
 const plan=latest(rows,'authorization',trip.id),parsed=planningModuleSchema.safeParse(plan?.local.data.formData);
 const approved=(plan?.server?.status||plan?.local.status)==='approved';
 const expenses=rows.filter(r=>r.kind==='expense'&&r.local.tripId===trip.id).map(r=>r.local.data);
 const [tab,setTab]=useState<'authorization'|'voucher'>(()=>approved&&expenses.length?'voucher':'authorization');
 const details={destination:text(trip.data.destination),installation:text(trip.data.installation)||undefined,departure:text(trip.data.departure),returnDate:text(trip.data.returnDate),purpose:text(trip.data.purpose),ordersNumber:text(trip.data.ordersNumber)||undefined};
 if(!parsed.success)return <div className="cw-card cw-empty"><h2>Plan your trip first.</h2><p className="cw-muted">Once your plan has costs, this page shows what to enter in DTS, step by step.</p><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Open the plan</Link></div>;
 return <div className="dts-sheet">
  <p className="dts-sheet-intro">Follow these steps in DTS. Each value has a copy button so you don’t have to retype it.</p>
  <div className="dts-sheet-tabs" role="tablist" aria-label="Which DTS document">
   <button type="button" role="tab" aria-selected={tab==='authorization'} onClick={()=>setTab('authorization')}>Authorization (before the trip)</button>
   <button type="button" role="tab" aria-selected={tab==='voucher'} onClick={()=>setTab('voucher')} disabled={!approved}>Voucher (after the trip)</button>
  </div>
  {!approved&&<p className="dts-sheet-note">The voucher steps open once your plan is approved.</p>}
  {tab==='voucher'&&approved?<>{!expenses.length&&<p className="dts-sheet-note">Add your expenses in Ouranos first and they’ll show up here. <Link href={`/dashboard/travel/vouchers?tripId=${trip.id}`}>Add expenses</Link></p>}
   <Sections sections={voucherSheet(details,expenses.map(e=>({category:text(e.category),description:text(e.description),merchant:text(e.merchant),incurredOn:text(e.incurredOn),amountMinor:Number(e.amountMinor)||0,paymentMethod:text(e.paymentMethod)||undefined})))}/></>
   :<Sections sections={authorizationSheet(details,parsed.data)}/>}
 </div>;
}
