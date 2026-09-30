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
