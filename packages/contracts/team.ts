import {z} from 'zod';

const organizationId=z.string().uuid();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const teamLevelSchema=z.enum(['s1','command']);
export type TeamLevel=z.infer<typeof teamLevelSchema>;
export const teamLevelNames:Record<TeamLevel,string>={s1:'S1 · Administration',command:'Command approval'};

export const teamQuery=z.object({organizationId,today:day.optional()}).strict();
export const teamMemberInput=z.object({organizationId,email:z.string().trim().email().max(320),level:teamLevelSchema}).strict();
export const teamMemberRemoval=z.object({organizationId,memberId:z.string().uuid(),level:teamLevelSchema}).strict();
export const paymentInput=z.object({organizationId,tripId:z.string().uuid(),amountMinor:z.number().int().positive().max(100_000_000_000),date:day}).strict();
export const paymentRemoval=z.object({organizationId,tripId:z.string().uuid()}).strict();
export const checklistStepSchema=z.object({id:z.string().min(1).max(40),title:z.string().trim().min(1).max(200),detail:z.string().trim().max(1000).optional()}).strict();
export const teamChecklistInput=z.object({organizationId,title:z.string().trim().min(1).max(120),steps:z.array(checklistStepSchema).min(1).max(40),dueOn:day.optional(),memberIds:z.array(z.string().uuid()).min(1).max(200)}).strict()
 .refine(v=>new Set(v.steps.map(s=>s.id)).size===v.steps.length,'Step ids must be unique').refine(v=>new Set(v.memberIds).size===v.memberIds.length,'Each person once');
export const checklistProgressInput=z.object({organizationId,doneStepIds:z.array(z.string().min(1).max(40)).max(40)}).strict();

export type TeamTrip={id:string;destination:string;departure:string;returnDate:string;purpose:string;phase:'past'|'current'|'upcoming';planStatus:string|null;voucherStatus:string|null;payStatus:'paid'|'awaiting'|'not_filed'|'not_due';plannedMinor:number|null;claimedMinor:number|null;paidMinor:number|null;approval:{status:string;current:string|null;waitingOnYou:boolean}|null};
export type TeamOverdue={kind:'voucher_not_filed'|'plan_draft'|'checklist_late'|'approval_late';label:string;tripId?:string;checklistId?:string};
export type TeamPerson={memberId:string;email:string;role:string|null;levels:TeamLevel[];trips:TeamTrip[];totals:{trips:number;plannedMinor:number;claimedMinor:number;paidMinor:number;awaitingMinor:number};overdue:TeamOverdue[];waitingOnYou:number;checklists:Array<{id:string;title:string;done:number;total:number;dueOn:string|null}>};
export type AssignedChecklist={id:string;title:string;steps:Array<z.infer<typeof checklistStepSchema>>;dueOn:string|null;doneStepIds:string[];createdAt:string};
