'use client';
import {useEffect,useState} from 'react';
import {Check} from 'lucide-react';
import {documentProgress,type DocumentMarks,type VoucherDocument} from '@/packages/domain/voucher-documents';
import './voucher-documents-card.css';

const storageKey=(tripId:string)=>`ouranos.voucherDocuments.${tripId}`;
function readMarks(tripId:string):DocumentMarks{try{const value=JSON.parse(localStorage.getItem(storageKey(tripId))||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}

/** What to attach in DTS before submitting the voucher. Ticks are kept on this device. */
export function VoucherDocumentsCard({tripId,documents}:{tripId:string;documents:VoucherDocument[]}){
 const [marks,setMarks]=useState<DocumentMarks>({});
 useEffect(()=>{const timer=setTimeout(()=>setMarks(readMarks(tripId)));return()=>clearTimeout(timer)},[tripId]);
 function mark(id:string,value:'done'|'na'|null){
  setMarks(current=>{const next={...current};if(value)next[id]=value;else delete next[id];try{localStorage.setItem(storageKey(tripId),JSON.stringify(next))}catch{/* ticks stay for this visit */}return next});
 }
 const progress=documentProgress(documents,marks);
 return <section className="cw-card voucher-docs" aria-labelledby="voucher-docs-title">
  <div className="voucher-docs-head"><h2 id="voucher-docs-title">What to attach in DTS</h2><span className={progress.complete?'is-complete':''}>{progress.ready} of {progress.total} ready</span></div>
  <p className="cw-muted">Missing or invalid receipts are one of the most common reasons DTS sends a voucher back. Attach these in DTS before you sign.</p>
  <ul>{documents.map(doc=>{const state=doc.auto?(doc.auto.done?'done':undefined):marks[doc.id];return <li key={doc.id} className={state?`is-${state}`:''}>
   {doc.auto?<span className="voucher-docs-mark is-auto" title="Checked by Ouranos" aria-hidden="true">{doc.auto.done&&<Check size={13}/>}</span>
    :<button type="button" className="voucher-docs-mark" aria-pressed={state==='done'} aria-label={`${doc.title}: ${state==='done'?'attached':'not attached yet'}`} onClick={()=>mark(doc.id,state==='done'?null:'done')}>{state==='done'&&<Check size={13}/>}</button>}
   <div><strong>{doc.title}</strong><p>{doc.detail}</p>{doc.auto&&<p className={doc.auto.done?'voucher-docs-ok':'voucher-docs-todo'}>{doc.auto.note} <span className="voucher-docs-auto">Checked by Ouranos</span></p>}
    {doc.optional&&!doc.auto&&<button type="button" className="voucher-docs-na" aria-pressed={state==='na'} onClick={()=>mark(doc.id,state==='na'?null:'na')}>{state==='na'?'Marked as not applying · undo':'Doesn’t apply to my trip'}</button>}</div>
  </li>})}</ul>
  <p className="voucher-docs-note">Ticks are saved on this device only.</p>
 </section>;
}
