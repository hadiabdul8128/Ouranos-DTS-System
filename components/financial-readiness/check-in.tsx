'use client';
import {useState,type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import type {FinancialProfile} from '@/packages/contracts/financial-readiness';
import {financialInputMoney,parseFinancialMoney} from '@/packages/domain/financial-readiness/money';
import {FinancialMoneyField as MoneyField} from './money-field';
export function FinancialCheckIn({profile,busy,onSave,onCancel}:{profile:FinancialProfile;busy:boolean;onSave:(p:FinancialProfile)=>void;onCancel:()=>void}){
 const [goal,setGoal]=useState(financialInputMoney(profile.goal.balanceMinor)),[emergency,setEmergency]=useState(financialInputMoney(profile.emergency.balanceMinor)),[error,setError]=useState('');
 function submit(e:FormEvent){e.preventDefault();const g=parseFinancialMoney(goal),em=parseFinancialMoney(emergency);if(g===null||em===null){setError('Enter both balances as dollars and cents.');return}onSave({...profile,goal:{...profile.goal,balanceMinor:g},emergency:{...profile.emergency,balanceMinor:em}})}
 return <form onSubmit={submit} className="finance-form"><h2>How are your savings doing?</h2><p className="finance-muted">Enter today’s balances. These are separate funds, so count each dollar once.</p><fieldset disabled={busy}><div className="finance-form-row"><MoneyField id="check-in-goal" label={`${profile.goal.name} balance`} value={goal} onChange={setGoal}/><MoneyField id="check-in-emergency" label="Emergency fund balance" value={emergency} onChange={setEmergency}/></div></fieldset>{error&&<p className="finance-error" role="alert">{error}</p>}<div className="finance-controls"><Button type="submit" disabled={busy}>{busy?'Saving…':'Update balances'}</Button><button type="button" className="finance-text-button" disabled={busy} onClick={onCancel}>Cancel</button></div><p className="finance-fine">This updates your reported progress. Ouranos does not move or verify money. The latest balances you enter each month appear in your history.</p></form>;
}
