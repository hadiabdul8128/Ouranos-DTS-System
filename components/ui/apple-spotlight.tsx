'use client';

import {AnimatePresence, LayoutGroup, motion, useReducedMotion} from 'framer-motion';
import {Command} from 'cmdk';
import {ChevronRight, Search, X} from 'lucide-react';
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {cn} from '@/lib/utils';
import './apple-spotlight.css';

export interface SpotlightShortcut {label:string;icon:ReactNode;link:string}
export interface SpotlightSearchResult extends SpotlightShortcut {description:string}
export interface AppleSpotlightProps {
 shortcuts?:SpotlightShortcut[];
 searchResults?:SpotlightSearchResult[];
 isOpen?:boolean;
 handleClose?:()=>void;
 inline?:boolean;
 className?:string;
 onSearchValueChange?:(value:string)=>void;
 onNavigate?:(link:string)=>void;
}

function SVGFilter({id}:{id:string}) {
 return <svg width="0" height="0" aria-hidden="true" className="spotlight-filter"><defs><filter id={id}><feGaussianBlur stdDeviation="10" in="SourceGraphic"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -9" result="blob"/><feBlend in="SourceGraphic" in2="blob"/></filter></defs></svg>;
}
function SpotlightPlaceholder({text,reduced}:{text:string;reduced:boolean}) {
 return <div className="spotlight-placeholder" aria-hidden="true"><AnimatePresence mode="popLayout"><motion.span key={text} initial={reduced?false:{opacity:0,y:10,filter:'blur(5px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} exit={reduced?{opacity:0}:{opacity:0,y:-10,filter:'blur(5px)'}} transition={{duration:reduced?0:.2,ease:'easeOut'}}>{text}</motion.span></AnimatePresence></div>;
}
function ShortcutButton({shortcut,onNavigate}:{shortcut:SpotlightShortcut;onNavigate?:(href:string)=>void}) {
 return <a href={shortcut.link} aria-label={shortcut.label} title={shortcut.label} className="spotlight-shortcut" onClick={event=>{if(onNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onNavigate(shortcut.link)}}}>{shortcut.icon}</a>;
}
function SearchResultCard({result,onSelect,disabled}:{result:SpotlightSearchResult;onSelect:()=>void;disabled:boolean}) {
 return <Command.Item value={result.label} disabled={disabled} onMouseDown={event=>event.preventDefault()} onSelect={onSelect} className="workspace-search-result"><span className="spotlight-result-icon">{result.icon}</span><span><strong>{result.label}</strong><small>{result.description}</small></span><ChevronRight size={20} aria-hidden="true" className="workspace-search-arrow"/></Command.Item>;
}

export function AppleSpotlight({shortcuts=[],searchResults=[],isOpen=true,handleClose,inline=false,className,onSearchValueChange,onNavigate}:AppleSpotlightProps) {
 const [hovered,setHovered]=useState(false),[hoveredShortcut,setHoveredShortcut]=useState<string|null>(null),[hoveredResult,setHoveredResult]=useState<string|null>(null),[searchValue,setSearchValue]=useState(''),[focused,setFocused]=useState(false),[opening,setOpening]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const filterId=`spotlight-${useId().replace(/[^a-zA-Z0-9]/g,'')}`;
 const reduced=Boolean(useReducedMotion());
 const expanded=focused&&Boolean(searchValue);
 useEffect(()=>{
  function shortcut(event:KeyboardEvent){if(isOpen&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.current?.focus();setFocused(true)}}
  window.addEventListener('keydown',shortcut);
  return ()=>window.removeEventListener('keydown',shortcut);
 },[isOpen]);
 function change(value:string){setSearchValue(value);setHoveredResult(null);setFocused(true);onSearchValueChange?.(value)}
 function navigate(link:string){if(opening)return;setOpening(true);setFocused(false);if(onNavigate)onNavigate(link);else window.location.assign(link)}
 return <AnimatePresence>{isOpen&&<motion.div className={cn('apple-spotlight',inline?'spotlight-inline':'spotlight-overlay',className)} initial={reduced?false:{opacity:0,filter:'blur(8px)',scaleX:1.08,scaleY:1.03,y:-10}} animate={{opacity:1,filter:'blur(0px)',scaleX:1,scaleY:1,y:0}} exit={{opacity:0,y:reduced?0:10}} transition={reduced?{duration:0}:{type:'spring',stiffness:550,damping:50}} onClick={inline?undefined:handleClose}>
  <SVGFilter id={filterId}/>
  <LayoutGroup id={filterId}>
   <div className="spotlight-row" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>{setHovered(false);setHoveredShortcut(null)}} onFocusCapture={()=>setHovered(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setFocused(false);setHovered(false);setHoveredShortcut(null)}}} onClick={event=>event.stopPropagation()}>
    <motion.div layout className="spotlight-search-shell" transition={reduced?{duration:0}:{layout:{type:'spring',bounce:.2,duration:.5}}}><Command className="workspace-search" data-open={expanded} shouldFilter={false} label="What do you want to do?" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setFocused(false);setHovered(false);input.current?.blur();if(!inline)handleClose?.()}}}>

      <div className="workspace-search-field">
       <motion.div layoutId="search-icon" className="spotlight-search-icon"><Search size={27} strokeWidth={1.4} aria-hidden="true"/></motion.div>
       <div className="spotlight-input-wrap">
        {(!searchValue||hoveredResult)&&<SpotlightPlaceholder text={hoveredShortcut??hoveredResult??'Search'} reduced={reduced}/>}
        <Command.Input asChild ref={input} value={searchValue} onValueChange={change} onFocus={()=>setFocused(true)} autoComplete="off" maxLength={500} disabled={opening}><motion.input layout="position" style={{opacity:hoveredResult?0:1}} role="combobox" aria-expanded={expanded}/></Command.Input>
       </div>
       {searchValue&&<button type="button" className="workspace-search-clear" aria-label="Clear search" onMouseDown={event=>event.preventDefault()} onClick={()=>{change('');input.current?.focus()}}><X size={16} aria-hidden="true"/></button>}
      </div>
      <Command.List className="workspace-search-results" hidden={!expanded} onMouseLeave={()=>setHoveredResult(null)}>
       <Command.Empty className="workspace-search-empty">No matching workflow. Try travel, meetings, inbox, or help.</Command.Empty>
       <AnimatePresence initial={false}>{expanded&&searchResults.map((result,index)=><motion.div key={result.link} onMouseEnter={()=>setHoveredResult(result.label)} initial={reduced?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:reduced?0:index*.04,duration:reduced?0:.2,ease:'easeOut'}}><SearchResultCard result={result} disabled={opening} onSelect={()=>navigate(result.link)}/></motion.div>)}</AnimatePresence>
      </Command.List>
    </Command></motion.div>
    <div className="spotlight-shortcuts" inert={Boolean(searchValue)} aria-hidden={Boolean(searchValue)}><AnimatePresence>{hovered&&!searchValue&&shortcuts.map((shortcut,index)=><motion.div key={shortcut.link} className="spotlight-shortcut-shell" layout onMouseEnter={()=>setHoveredShortcut(shortcut.label)} onFocus={()=>setHoveredShortcut(shortcut.label)} initial={reduced?false:{scale:.7,x:-52*(index+1),opacity:0}} animate={{scale:1,x:0,opacity:1}} exit={{scale:reduced?1:.7,x:reduced?0:16*(shortcuts.length-index-1),opacity:0}} transition={reduced?{duration:0}:{duration:.6,type:'spring',bounce:.2,delay:index*.04}} style={{filter:reduced?undefined:`url(#${filterId})`}}><ShortcutButton shortcut={shortcut} onNavigate={navigate}/></motion.div>)}</AnimatePresence></div>
   </div>
  </LayoutGroup>
  <p className="intent-hint" role="status">{opening?'Opening your workspace…':''}</p>
 </motion.div>}</AnimatePresence>;
}
