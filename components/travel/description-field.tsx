'use client';
import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {commonOptions,dtsOptions,isListedDescription} from '@/packages/domain/expense-descriptions';

const OTHER='__other';

/** A dropdown of DTS expense types and common descriptions for the expense type, with Other for anything else. */
export function DescriptionField({category,value,onChange,maxLength=300}:{category:string;value:string;onChange:(value:string)=>void;maxLength?:number}){
 const dts=dtsOptions(category),common=commonOptions(category);
 const [typing,setTyping]=useState(()=>Boolean(value)&&!isListedDescription(category,value));
 const choice=typing?OTHER:isListedDescription(category,value)?value:'';
 return <div className="description-field">
  <select aria-label="Description" value={choice} onChange={e=>{if(e.target.value===OTHER){setTyping(true);onChange('')}else{setTyping(false);onChange(e.target.value)}}}>
   <option value="">Choose a description</option>
   {dts.length>0&&<optgroup label="DTS expense types">{dts.map(option=><option key={option} value={option}>{option}</option>)}</optgroup>}
   <optgroup label={dts.length?'Other common':'Common'}>{common.map(option=><option key={option} value={option}>{option}</option>)}<option value={OTHER}>Other (type your own)</option></optgroup>
  </select>
  {typing&&<Input aria-label="Describe this expense" value={value} onChange={e=>onChange(e.target.value)} maxLength={maxLength} placeholder="Describe this expense" autoFocus={!value}/>}
 </div>;
}
