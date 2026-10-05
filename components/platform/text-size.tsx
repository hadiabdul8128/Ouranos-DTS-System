'use client';
import {useEffect} from 'react';
import {usePersonalState} from './personal-state';

const apply=(large:boolean)=>{if(large)document.documentElement.dataset.text='large';else delete document.documentElement.dataset.text};

/** Applies the reader's text size on every page. */
export function TextSizeSync(){const {state}=usePersonalState<{largeText?:boolean}>('preferences',{});useEffect(()=>apply(Boolean(state.largeText)),[state.largeText]);return null}

/** Settings switch: bigger text and buttons across Ouranos, saved to the user's workspace. */
export function TextSizeSwitch(){
 const {state,update}=usePersonalState<{largeText?:boolean}>('preferences',{});const large=Boolean(state.largeText);
 function change(value:boolean){apply(value);update(current=>({...current,largeText:value}))}
 return <label className="text-size-switch"><input type="checkbox" role="switch" checked={large} onChange={e=>change(e.target.checked)}/><span><strong>Larger text</strong><small>Makes words and buttons bigger on every page.</small></span></label>;
}
