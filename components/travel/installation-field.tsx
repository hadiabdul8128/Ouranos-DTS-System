'use client';
import {Input} from '@/components/ui/input';

/** The base or installation, kept next to the nearest city the way DTS asks for both. */
export function InstallationField({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}){
 return <div className="travel-field installation-field">
  <label htmlFor={id}>Installation or base · optional</label>
  <Input id={id} value={value} onChange={e=>onChange(e.target.value)} maxLength={120} placeholder="e.g. Joint Base Lewis-McChord" autoComplete="off"/>
  <small className="place-hint">DTS asks for both: the installation here, and the nearest city above.</small>
 </div>;
}
