'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {GLOSSARY,splitTerms} from '@/packages/domain/glossary';
import './explain.css';

/** A travel term with a dotted underline; tap it for a one-sentence meaning. */
export function Term({term}:{term:string}){
 const entry=GLOSSARY[term],[open,setOpen]=useState(false),[shift,setShift]=useState(0),id=useId(),ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  if(!open)return;
  const close=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==='Escape':!ref.current?.contains(event.target as Node))setOpen(false)};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)};
 },[open]);
 // Keep the box on screen: shift it left when the term sits near the right edge.
 function toggle(){
  const left=ref.current?.getBoundingClientRect().left??0,width=Math.min(280,window.innerWidth*0.8);
  setShift(Math.min(0,window.innerWidth-16-(left+width)));setOpen(value=>!value);
 }
 if(!entry)return <>{term}</>;
 return <span className="term" ref={ref}>
  <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle}>{term}</button>
  {open&&<span className="term-pop" id={id} role="note" style={{left:shift}}><strong>{entry.name}</strong>{entry.meaning}</span>}
 </span>;
}

/** Plain text with each known travel term made tappable the first time it appears. */
export function Explain({children}:{children:string}){
 return <>{splitTerms(children).map((part,index)=>typeof part==='string'?part:<Term key={index} term={part.term}/>)}</>;
}
