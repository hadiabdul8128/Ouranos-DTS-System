'use client';
import {createContext,useContext,useId,useRef,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useMotionValue,useReducedMotion,useSpring,useTransform,type MotionValue} from 'framer-motion';

const DockContext=createContext<MotionValue<number>|null>(null);
const DockActiveContext=createContext(false);
export function useDockActive(){return useContext(DockActiveContext)}
/** Compact dock adaptation: native links and buttons retain focus and activation. */
export function Dock({children,className}:{children:ReactNode;className?:string}) {
 const mouseX=useMotionValue(Infinity);
 return <DockContext.Provider value={mouseX}><nav className={className} aria-label="Workspace" onPointerMove={event=>{if(event.pointerType==='mouse')mouseX.set(event.clientX)}} onPointerLeave={()=>mouseX.set(Infinity)}>{children}</nav></DockContext.Provider>;
}
export function DockItem({children,label}:{children:ReactNode;label:string}) {
 const mouseX=useContext(DockContext);
 if(!mouseX)throw new Error('DockItem requires Dock');
 return <DockItemMotion mouseX={mouseX} label={label}>{children}</DockItemMotion>;
}
function DockItemMotion({children,label,mouseX}:{children:ReactNode;label:string;mouseX:MotionValue<number>}) {
 const ref=useRef<HTMLDivElement>(null),id=useId();
 const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
 const reduced=useReducedMotion();
 const proximity=useTransform(mouseX,value=>{const rect=ref.current?.getBoundingClientRect();return rect?Math.max(0,1-Math.abs(value-rect.x-rect.width/2)/100):0});
 const targetScale=useTransform(proximity,value=>reduced?1:1+value*.14);
 const targetY=useTransform(proximity,value=>reduced?0:-value*4);
 const scale=useSpring(targetScale,{mass:.1,stiffness:150,damping:12});
 const y=useSpring(targetY,{mass:.1,stiffness:150,damping:12});
 return <motion.div ref={ref} className="workspace-dock-item" style={{scale,y}} onHoverStart={()=>setHovered(true)} onHoverEnd={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}}>
  <DockActiveContext.Provider value={hovered||focused}>{children}</DockActiveContext.Provider>
  <AnimatePresence>{(hovered||focused)&&<motion.span id={id} role="tooltip" className="workspace-dock-label" style={{x:'-50%'}} initial={{opacity:0,y:reduced?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:4}} transition={{duration:reduced?0:.18}}>{label}</motion.span>}</AnimatePresence>
 </motion.div>;
}
