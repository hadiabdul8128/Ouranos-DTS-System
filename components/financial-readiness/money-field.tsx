import {Input} from '@/components/ui/input';
export function FinancialMoneyField({id,label,value,onChange,hint,required=true}:{id:string;label:string;value:string;onChange:(v:string)=>void;hint?:string;required?:boolean}){
 return <div className="finance-field"><label htmlFor={id}>{label}</label><div className="finance-money-input"><span aria-hidden="true">$</span><Input id={id} value={value} required={required} inputMode="decimal" autoComplete="off" maxLength={18} onChange={e=>onChange(e.target.value)} aria-describedby={hint?`${id}-hint`:undefined}/></div>{hint&&<p id={`${id}-hint`} className="finance-hint">{hint}</p>}</div>;
}
