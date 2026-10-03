'use client';
import {Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Entity} from '@/packages/contracts';
import type {PlannedExpense} from '@/packages/contracts/planning-module';
import './planned-costs.css';

const money=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
type Props={items:PlannedExpense[];expenses:Entity[];notUsed:Set<string>;locked:boolean;busy:boolean;
 onSame:(item:PlannedExpense)=>void;onDifferent:(item:PlannedExpense)=>void;onNotUsed:(item:PlannedExpense,notUsed:boolean)=>void;onEdit:(expense:Entity)=>void};

/** Each approved cost with one tap to say it cost what was planned, so only surprises need typing. */
export function PlannedCosts({items,expenses,notUsed,locked,busy,onSame,onDifferent,onNotUsed,onEdit}:Props){
 if(!items.length)return null;
 const left=items.filter(item=>!expenses.some(e=>e.data.authorizationItemId===item.id)&&!notUsed.has(item.id)).length;
 return <section className="planned-costs" aria-labelledby="planned-costs-title">
  <div className="planned-costs-head"><h3 id="planned-costs-title">Your planned costs</h3><span>{left?`${left} to go`:'All done'}</span></div>
  <p className="cw-muted">Did each one cost what you planned? One tap adds it. Then add its receipt below.</p>
  <ul>{items.map(item=>{
   const expense=expenses.find(e=>e.data.authorizationItemId===item.id),skipped=notUsed.has(item.id);
   return <li key={item.id} className={expense?'is-added':skipped?'is-skipped':''}>
    <div className="planned-costs-name"><strong>{item.description}</strong><span>Planned {money(item.authorizedAmountMinor)}</span></div>
    {expense?<div className="planned-costs-done"><span><Check size={14}/> Added · {money(Number(expense.data.amountMinor))}</span>{!locked&&<button type="button" onClick={()=>onEdit(expense)}>Edit</button>}</div>
     :skipped?<div className="planned-costs-done"><span>Not used</span>{!locked&&<button type="button" onClick={()=>onNotUsed(item,false)}>Undo</button>}</div>
     :!locked&&<div className="planned-costs-actions">
      <Button type="button" onClick={()=>onSame(item)} disabled={busy}>Same · {money(item.authorizedAmountMinor)}</Button>
      <Button type="button" variant="outline" onClick={()=>onDifferent(item)} disabled={busy}>It was different</Button>
      <button type="button" className="planned-costs-skip" onClick={()=>onNotUsed(item,true)} disabled={busy}>Didn’t use it</button>
     </div>}
   </li>;
  })}</ul>
 </section>;
}
