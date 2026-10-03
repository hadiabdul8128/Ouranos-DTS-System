import type {AmendmentBaseline} from '../contracts/planning-module';

const usd=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
const day=(value:string)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'none';
type Item=AmendmentBaseline['items'][number];
export type PlanVersion=Omit<AmendmentBaseline,'items'>&{items:Item[]};
export type Change={label:string;from:string;to:string};

const total=(items:Item[])=>items.reduce((sum,item)=>sum+item.authorizedAmountMinor,0);
const name=(item:Item)=>item.description||item.category;

/** Plain-language differences between what was approved and the changed plan, in the order a reviewer reads them. */
export function amendmentChanges(previous:PlanVersion,current:PlanVersion):Change[]{
 const changes:Change[]=[];
 const field=(label:string,from:string,to:string)=>{if(from!==to)changes.push({label,from,to})};
 field('Destination',previous.destination,current.destination);
 field('Installation',previous.installation??'none',current.installation??'none');
 field('Departure',day(previous.departure),day(current.departure));
 field('Return',day(previous.returnDate),day(current.returnDate));
 field('Purpose',previous.purpose,current.purpose);
 const before=new Map(previous.items.map(item=>[item.id,item])),after=new Map(current.items.map(item=>[item.id,item]));
 for(const item of current.items){
  const old=before.get(item.id);
  if(!old)changes.push({label:`Added · ${name(item)}`,from:'—',to:usd(item.authorizedAmountMinor)});
  else if(old.authorizedAmountMinor!==item.authorizedAmountMinor||name(old)!==name(item))changes.push({label:name(item),from:`${name(old)!==name(item)?`${name(old)} · `:''}${usd(old.authorizedAmountMinor)}`,to:usd(item.authorizedAmountMinor)});
 }
 for(const item of previous.items)if(!after.has(item.id))changes.push({label:`Removed · ${name(item)}`,from:usd(item.authorizedAmountMinor),to:'—'});
 if(total(previous.items)!==total(current.items))changes.push({label:'Total',from:usd(total(previous.items)),to:usd(total(current.items))});
 return changes;
}
