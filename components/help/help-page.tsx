'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowLeft,Settings} from 'lucide-react';
import {InboxLink} from '@/components/inbox/inbox-link';
import {helpGuides} from './guides';
import './help-page.css';
import {Explain} from '@/components/travel/explain';

const guideFromHash=()=>helpGuides.find(g=>`#${g.id}`===window.location.hash)?.id;

export function HelpPage(){
 const [active,setActive]=useState(helpGuides[0]!.id);
 useEffect(()=>{
  const sync=()=>{const id=guideFromHash();if(id)setActive(id)};
  const timer=setTimeout(sync);window.addEventListener('hashchange',sync);
  return()=>{clearTimeout(timer);window.removeEventListener('hashchange',sync)};
 },[]);
 const guide=helpGuides.find(g=>g.id===active)??helpGuides[0]!;
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link className="quiet-brand" href="/dashboard">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link href="/dashboard/platform" aria-label="Settings"><Settings size={18}/></Link></nav></header>
  <section className="cw-shell help-shell">
   <Link className="back-link" href="/dashboard/travel"><ArrowLeft size={14}/> Travel</Link>
   <h1>Help.</h1><p className="help-sub">Pick what you’re doing. Each guide is a few steps with a picture of the screen.</p>
   <nav className="help-picker" aria-label="Guides">{helpGuides.map(g=><a key={g.id} href={`#${g.id}`} aria-current={g.id===guide.id?'true':undefined} onClick={()=>setActive(g.id)}>{g.title}</a>)}</nav>
   <article className="help-guide" aria-labelledby="help-guide-title">
    <h2 id="help-guide-title">{guide.title}</h2><p className="help-summary">{guide.summary}</p>
    <ol className="help-steps">{guide.steps.map((step,i)=><li key={step.image}>
     <div className="help-step-text"><span aria-hidden="true">{i+1}</span><div><h3>{step.title}</h3><p><Explain>{step.text}</Explain></p></div></div>
     <figure><Image src={`/help/${step.image}.webp`} width={640} height={step.height} alt={step.alt} sizes="(max-width: 700px) 340px, 300px" priority={i===0}/></figure>
    </li>)}</ol>
   </article>
   <aside className="help-ask" aria-labelledby="help-ask-title">
    <h2 id="help-ask-title">Who to ask</h2>
    <dl>
     <div><dt>Your S1</dt><dd>Orders, who your approvers are, and anything about your unit’s process.</dd></div>
     <div><dt>Your unit travel administrator</dt><dd>Your account, your approvers and which funding (line of accounting) to use.</dd></div>
    </dl>
   </aside>
  </section></main>;
}
