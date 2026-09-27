const day=24*60*60*1000;

export function stayNights(checkin:string,checkout:string){
 const start=Date.parse(`${checkin}T00:00:00Z`),end=Date.parse(`${checkout}T00:00:00Z`);
 if(!Number.isFinite(start)||!Number.isFinite(end))return 0;
 if(new Date(start).toISOString().slice(0,10)!==checkin||new Date(end).toISOString().slice(0,10)!==checkout)return 0;
 const nights=Math.round((end-start)/day);
 return nights>0?nights:0;
}

export function averageNightlyPrice(total:number,checkin:string,checkout:string){
 const nights=stayNights(checkin,checkout);
 return nights&&Number.isFinite(total)&&total>0?total/nights:null;
}
