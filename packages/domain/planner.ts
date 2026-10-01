/** Checklists from instructions, and the upcoming list. Pure functions; nothing here is sent anywhere. */

export type ChecklistStep={id:string;title:string;detail?:string;due?:string;done?:boolean};
export type Checklist={id:string;title:string;source:'instructions'|'guide'|'ai';instructions:string;createdAt:string;steps:ChecklistStep[]};
export const plannerKinds=['appointment','deadline','deployment','other'] as const;
export type PlannerKind=typeof plannerKinds[number];
export type PlannerItem={id:string;kind:PlannerKind;title:string;date:string;time?:string;notes?:string;done?:boolean};
export type UpcomingEntry={key:string;date:string;time?:string;title:string;kind:PlannerKind|'trip'|'voucher'|'checklist';detail?:string;href?:string;itemId?:string;checklist?:{id:string;stepId:string}};

const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const pad=(n:number)=>String(n).padStart(2,'0');
const iso=(y:number,m:number,d:number)=>{const date=new Date(Date.UTC(y,m,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m&&date.getUTCDate()===d?`${y}-${pad(m+1)}-${pad(d)}`:null};
export const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
/** A date without a year is taken as its next occurrence, allowing a month of lateness. */
function withYear(m:number,d:number,today:string){const y=Number(today.slice(0,4));const candidate=iso(y,m,d);if(!candidate)return null;return candidate<addDays(today,-31)?iso(y+1,m,d):candidate}
const fullYear=(y:string)=>y.length===2?2000+Number(y):Number(y);

/** Finds the first date in a line of instructions: 2026-10-15, 10/15, 15 Oct, Oct 15, 15OCT26, tomorrow, in 3 days. */
export function parseDue(text:string,today:string):string|undefined{
 const t=text.toLowerCase();
 let m=/\b(20\d\d)-(\d\d)-(\d\d)\b/.exec(t);if(m)return iso(Number(m[1]),Number(m[2])-1,Number(m[3]))??undefined;
 m=/\b(\d{1,2})\s?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s?((?:20)?\d\d)?\b/.exec(t);
 if(m){const mo=MONTHS.indexOf(m[2]!);return (m[3]?iso(fullYear(m[3]),mo,Number(m[1])):withYear(mo,Number(m[1]),today))??undefined}
 m=/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s(\d{1,2})(?:st|nd|rd|th)?(?:,?\s(20\d\d))?\b/.exec(t);
 if(m){const mo=MONTHS.indexOf(m[1]!);return (m[3]?iso(Number(m[3]),mo,Number(m[2])):withYear(mo,Number(m[2]),today))??undefined}
 m=/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
 if(m){const mo=Number(m[1])-1,d=Number(m[2]);return (m[3]?iso(fullYear(m[3]),mo,d):withYear(mo,d,today))??undefined}
 if(/\btoday\b/.test(t))return today;
 if(/\btomorrow\b/.test(t))return addDays(today,1);
 m=/\bin (\d{1,3}) (day|week)s?\b/.exec(t);if(m)return addDays(today,Number(m[1])*(m[2]==='week'?7:1));
 return undefined;
}

const newId=()=>globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);
/** Each bullet, numbered line or sentence becomes a step; dates in it become the step's due date. */
export function stepsFromInstructions(text:string,today:string):ChecklistStep[]{
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const pieces=(lines.length>1?lines:text.split(/(?<=[.;!?])\s+(?=[A-Z0-9])/))
  .map(piece=>piece.replace(/^(?:[-*•▪◦]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+/i,'').trim()).filter(piece=>piece.length>=3);
 return pieces.slice(0,30).map(piece=>{
  const sentence=piece.replace(/\s+/g,' ');const cut=sentence.length>110?sentence.slice(0,sentence.lastIndexOf(' ',100)||100)+'…':sentence;
  const due=parseDue(sentence,today);
  return {id:newId(),title:cut.replace(/[.;]$/,''),...(cut!==sentence?{detail:sentence}:{}),...(due?{due}:{})};
 });
}

type Guide={title:string;match:RegExp;steps:Array<[string,string]>};
const CONFIRM:[string,string]=['Confirm your unit’s requirements','Your command, S1 and orders set the actual requirements and deadlines. Use this list as a starting point and follow their direction where it differs.'];
/** General starting points for common tasks. They are not service- or unit-specific policy. */
export const GUIDES:Guide[]=[
 {title:'Prepare for deployment',match:/\b(deploy(?:ment|ing)?|mobiliz\w*|pre-?deployment)\b/i,steps:[
  ['Review your orders and report date','Read your orders for report date, location and any required training or gear, and ask your chain of command about anything unclear.'],
  ['Update your Record of Emergency Data (DD Form 93)','Make sure next of kin and contact information are current. Your S1 or admin office can help.'],
  ['Review SGLI coverage and beneficiaries','Check and update life insurance beneficiaries in the SGLI Online Enrollment System (SOES) through milConnect.'],
  ['Complete medical and dental readiness','Schedule any overdue periodic health assessment, dental exam, immunizations or other readiness items with your clinic.'],
  ['Set up legal documents','Visit the installation legal assistance office for powers of attorney and a will if you need them.'],
  ['Arrange family care and household matters','Update your family care plan if required, and plan for pets, vehicles, housing and bills while you are gone.'],
  ['Check pay and allotments','Review your pay, direct deposit and any allotments in myPay before you leave.'],
  ['Pack required gear','Use your unit packing list and inventory issued equipment.'],
  CONFIRM]},
 {title:'Prepare for a PCS move',match:/\b(pcs|permanent change of station|change of station|relocat\w*|new duty station)\b/i,steps:[
  ['Get your orders','You need official PCS orders before scheduling a move or making travel arrangements.'],
  ['Schedule your household goods move','Start your shipment request early through move.mil or your installation transportation office.'],
  ['Plan travel','Arrange travel through DTS or your travel office as your orders allow.'],
  ['Handle housing','Give notice to base housing or your landlord, and contact the housing office at your new installation.'],
  ['Out-process your current installation','Complete your unit and installation checkout requirements.'],
  ['Hand-carry important records','Keep orders, medical and dental records, and family documents with you rather than in the shipment.'],
  ['Request advance pay if you need it','Ask your finance office about advance pay and allowances.'],
  ['Submit your travel voucher','File your PCS travel claim after you arrive, within the time your finance office requires.'],
  CONFIRM]},
 {title:'Request leave',match:/\b(leave|pto|time off|vacation)\b/i,steps:[
  ['Check your leave balance','Look up your balance on your leave and earnings statement in myPay.'],
  ['Choose dates and talk to your supervisor','Agree on dates with your chain of command before submitting.'],
  ['Submit the leave request','Use your service’s leave system or form, including your address and phone while on leave.'],
  ['Get approval before you go','Make sure your request is approved and you have a copy.'],
  ['Sign out and sign back in','Follow your unit’s procedure for starting and ending leave.'],
  CONFIRM]},
 {title:'Prepare for separation or retirement',match:/\b(separat\w*|retir\w*|ets|eas|getting out|leaving the military)\b/i,steps:[
  ['Start the Transition Assistance Program (TAP)','Contact your installation transition office; TAP generally starts at least 365 days before separation.'],
  ['Schedule your separation health assessment','Book it with your clinic, and consider filing a VA disability claim before separation.'],
  ['Plan your next step','Compare employment, training and education options. Ouranos Transition can help you compare them.'],
  ['Review benefits','Look at GI Bill, VA health care, insurance conversion and final pay.'],
  ['Get copies of your records','Collect your service, medical and training records before you leave.'],
  CONFIRM]},
 {title:'Temporary duty (TDY) travel',match:/\b(tdy|temporary duty|travel orders)\b/i,steps:[
  ['Create your trip in Ouranos','Enter where and when you are going, then plan your expenses.'],
  ['Get your authorization approved','Submit your plan for S1 and command review before you travel.'],
  ['Book travel','Book through DTS or your travel office; Ouranos suggestions are estimates only.'],
  ['Keep your receipts','Save lodging and other required receipts during the trip.'],
  ['File your voucher after you return','Submit your travel voucher within 5 working days of returning.'],
  CONFIRM]},
];
export const matchGuide=(text:string)=>GUIDES.find(guide=>guide.match.test(text));

/** A checklist built on the device: a matching guide for short requests, otherwise the instructions themselves. */
export function localChecklist(text:string,today:string,now=new Date()):Checklist{
 // Only a short one-line request gets a starting guide; pasted instructions always keep their own tasks.
 const guide=text.trim().length<100&&!/\n/.test(text.trim())?matchGuide(text):undefined;
 const steps=guide?guide.steps.map(([title,detail])=>({id:newId(),title,detail})):stepsFromInstructions(text,today);
 const title=guide?.title??(steps.length>1?`${steps[0]!.title.slice(0,48)}${steps[0]!.title.length>48?'…':''} and ${steps.length-1} more`:steps[0]?.title.slice(0,70))??'Checklist';
 return {id:newId(),title,source:guide?'guide':'instructions',instructions:text,createdAt:now.toISOString(),steps};
}

type TripRow={id:string;destination:string;departure:string;returnDate:string;voucherDone?:boolean};
/** Travelers file vouchers within 5 working days of returning. */
export function voucherDue(returnDate:string){let date=returnDate,left=5;while(left>0){date=addDays(date,1);const day=new Date(`${date}T12:00:00Z`).getUTCDay();if(day!==0&&day!==6)left--}return date}

/** Everything coming up, oldest first, from today back to overdue items still open. Voucher deadlines can be left out. */
export function upcomingEntries(items:PlannerItem[],checklists:Checklist[],trips:TripRow[],today:string,{vouchers=true}:{vouchers?:boolean}={}):UpcomingEntry[]{
 const entries:UpcomingEntry[]=[];
 for(const item of items)if(!item.done)entries.push({key:`item:${item.id}`,date:item.date,...(item.time?{time:item.time}:{}),title:item.title,kind:item.kind,...(item.notes?{detail:item.notes}:{}),itemId:item.id});
 for(const list of checklists)for(const step of list.steps)if(step.due&&!step.done)entries.push({key:`step:${list.id}:${step.id}`,date:step.due,title:step.title,kind:'checklist',detail:list.title,href:'/dashboard/checklists',checklist:{id:list.id,stepId:step.id}});
 for(const trip of trips){
  if(trip.departure>=today)entries.push({key:`trip:${trip.id}:out`,date:trip.departure,title:`Travel to ${trip.destination}`,kind:'trip',href:`/dashboard/travel/planning?tripId=${trip.id}`});
  if(trip.returnDate>=today)entries.push({key:`trip:${trip.id}:back`,date:trip.returnDate,title:`Return from ${trip.destination}`,kind:'trip',href:`/dashboard/travel/planning?tripId=${trip.id}`});
  const due=voucherDue(trip.returnDate);
  if(vouchers&&!trip.voucherDone&&due>=addDays(today,-30))entries.push({key:`trip:${trip.id}:voucher`,date:due,title:`Voucher due · ${trip.destination}`,kind:'voucher',detail:'Within 5 working days of returning',href:`/dashboard/travel/vouchers?tripId=${trip.id}`});
 }
 return entries.sort((a,b)=>a.date.localeCompare(b.date)||(a.time??'').localeCompare(b.time??''));
}

/** Remaining days of trips that have not ended, from today on, capped at 60 days per trip. */
export function travelDays(trips:Array<{departure:string;returnDate:string}>,today:string){
 const days=new Set<string>();
 for(const trip of trips){if(trip.returnDate<today||trip.returnDate<trip.departure)continue;for(let day=trip.departure<today?today:trip.departure,n=0;day<=trip.returnDate&&n<60;day=addDays(day,1),n++)days.add(day)}
 return [...days].sort();
}
