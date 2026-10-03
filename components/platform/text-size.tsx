'use client';
import {useEffect,useState} from 'react';

const KEY='ouranos.textSize';
const read=()=>{try{return localStorage.getItem(KEY)==='large'}catch{return false}};
const apply=(large:boolean)=>{if(large)document.documentElement.dataset.text='large';else delete document.documentElement.dataset.text};

/** Applies the reader's text size on every page. */
export function TextSizeSync(){useEffect(()=>apply(read()),[]);return null}

/** Settings switch: bigger text and buttons across Ouranos, remembered on this device. */
export function TextSizeSwitch(){
 const [large,setLarge]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setLarge(read()));return()=>clearTimeout(timer)},[]);
 function change(value:boolean){setLarge(value);apply(value);try{localStorage.setItem(KEY,value?'large':'normal')}catch{/* still applies for this visit */}}
 return <label className="text-size-switch"><input type="checkbox" role="switch" checked={large} onChange={e=>change(e.target.checked)}/><span><strong>Larger text</strong><small>Makes words and buttons bigger on every page.</small></span></label>;
}
