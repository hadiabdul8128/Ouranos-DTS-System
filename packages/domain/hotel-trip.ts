import {tripInput} from '../contracts';
import {planningModuleSchema} from '../contracts/planning-module';
import type {LocalRecord} from '../offline/database';

export type HotelTripContext={id:string;destination:string;departure:string;returnDate:string;lodgingBudgetMinor:number|null;budgetLabel:'Approved lodging budget'|'Planned lodging budget'|null};

export function hotelTripContext(rows:LocalRecord[],tripId:string):HotelTripContext|null{
 const trip=rows.find(row=>row.kind==='trip'&&row.id===tripId);
 const parsedTrip=tripInput.safeParse(trip?.local.data);
 if(!trip||!parsedTrip.success)return null;
 const authorization=rows.filter(row=>row.kind==='authorization'&&row.local.tripId===tripId).sort((a,b)=>{
  const aApproved=a.server?.status==='approved'||a.local.status==='approved';
  const bApproved=b.server?.status==='approved'||b.local.status==='approved';
  return Number(bApproved)-Number(aApproved)||b.local.updatedAt.localeCompare(a.local.updatedAt);
 })[0];
 const parsedPlan=planningModuleSchema.safeParse(authorization?.local.data.formData);
 const lodging=parsedPlan.success?parsedPlan.data.approvedExpenseItems.filter(item=>item.category==='lodging'):[];
 return {
  id:tripId,destination:parsedTrip.data.destination,departure:parsedTrip.data.departure,returnDate:parsedTrip.data.returnDate,
  lodgingBudgetMinor:lodging.length?lodging.reduce((sum,item)=>sum+item.authorizedAmountMinor,0):null,
  budgetLabel:lodging.length?(authorization?.server?.status==='approved'||authorization?.local.status==='approved'?'Approved lodging budget':'Planned lodging budget'):null,
 };
}
