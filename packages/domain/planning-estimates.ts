/** Replace matching draft rows before discarding unused placeholders. */
export function mergePlanningEstimates<T extends {id:string;amount:string;description:string;merchant:string}>(current:T[],estimates:T[]):T[]{
 const replacements=new Map(estimates.map(item=>[item.id,item]));
 const existingIds=new Set(current.map(item=>item.id));
 return [...current.map(item=>replacements.get(item.id)||item).filter(item=>item.amount||item.description||item.merchant),...estimates.filter(item=>!existingIds.has(item.id))];
}
