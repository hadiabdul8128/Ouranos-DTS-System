"use client";

// Adapted from AnimateIcons by Avijit Dey (@avijit07x), MIT.
// https://github.com/Avijit07x/animateicons
import {motion,useReducedMotion,type Variants} from "motion/react";
import {useDockActive} from "./dock";

export function CalendarSearchIcon({size=16}:{size?:number}) {
 const active=useDockActive();
 const reduced=useReducedMotion();
 const draw:Variants={normal:{pathLength:1,opacity:1},animate:{pathLength:[0,1],opacity:[0,1],transition:{duration:.5,ease:[.16,1,.3,1]}}};
 const hanger:Variants={normal:{pathLength:1,opacity:1},animate:(i:number)=>({pathLength:[0,1],opacity:[0,1],transition:{duration:.3,delay:i*.08,ease:[.16,1,.3,1]}})};
 return <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" initial="normal" animate={active&&!reduced?'animate':'normal'}>
  <motion.path d="M8 2v4" custom={0} variants={hanger}/>
  <motion.path d="M16 2v4" custom={1} variants={hanger}/>
  <motion.path d="M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25" variants={draw}/>
  <motion.path d="M3 10h18" variants={{normal:{scaleX:1,opacity:1},animate:{scaleX:[0,1],opacity:[0,1],transition:{duration:.4,delay:.28}}}} style={{transformOrigin:'3px 10px'}}/>
  <motion.circle cx={18} cy={18} r={3} variants={{normal:{scale:1,opacity:1},animate:{scale:[0,1.15,1],opacity:[0,1,1],transition:{duration:.4,delay:.42,times:[0,.6,1]}}}} style={{transformOrigin:'18px 18px'}}/>
  <motion.path d="m22 22-1.875-1.875" variants={{normal:{pathLength:1,opacity:1},animate:{pathLength:[0,1],opacity:[0,1],transition:{duration:.3,delay:.7}}}}/>
 </motion.svg>;
}
