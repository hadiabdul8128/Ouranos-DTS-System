import {z} from 'zod';
import {uuid,type Entity} from './index';

/** Level 1 is the S1 (administration) review; level 2 is command approval. */
export const APPROVAL_LEVEL_NAMES=['S1 · Administration','Command approval'] as const;
export const approvalLevelName=(position:number,label?:string)=>label?.trim()||APPROVAL_LEVEL_NAMES[position]||`Level ${position+1}`;

export const levelStatuses=['pending','approved','changes_requested','rejected'] as const;
export const approvalLevelSchema=z.object({position:z.number().int().nonnegative(),label:z.string().min(1).max(80),role:z.enum(['reviewer','approver']),status:z.enum(levelStatuses),decidedAt:z.string().datetime().optional(),comment:z.string().max(4000).optional()});
export type ApprovalLevel=z.infer<typeof approvalLevelSchema>;
export const approvalLevelsSchema=z.array(approvalLevelSchema).min(1).max(10);

export function initialApprovalLevels(steps:Array<{role:'reviewer'|'approver';label?:string}>):ApprovalLevel[]{
 return steps.map((step,position)=>({position,label:approvalLevelName(position,step.label),role:step.role,status:'pending'}));
}
/** Record one decision; later levels stay pending. */
export function decideApprovalLevel(levels:ApprovalLevel[],position:number,decision:Exclude<ApprovalLevel['status'],'pending'>,decidedAt:string,comment=''):ApprovalLevel[]{
 return levels.map(level=>level.position===position?{...level,status:decision,decidedAt,...(comment.trim()?{comment:comment.trim()}:{})}:level);
}
/** Levels stored on the request, or a best-effort view for requests made before levels were recorded. */
export function approvalLevelsOf(request:Pick<Entity,'status'|'data'>):ApprovalLevel[]{
 const stored=approvalLevelsSchema.safeParse(request.data.levels);
 if(stored.success)return stored.data;
 const status=request.status==='in_review'?'pending':request.status as ApprovalLevel['status'];
 return [{position:0,label:'Review',role:'reviewer',status:levelStatuses.includes(status)?status:'pending'}];
}
export const currentApprovalLevel=(levels:ApprovalLevel[])=>levels.find(level=>level.status!=='approved')??null;

/** DTS asks approvers to act within 72 hours. */
export const APPROVAL_ALERT_HOURS=72;
/** When the current level received a request still in review: the prior level's decision, else submission. */
export function waitingSince(request:Pick<Entity,'status'|'data'>&{updatedAt?:string}):string|null{
 if(request.status!=='in_review')return null;
 const levels=approvalLevelsOf(request),current=currentApprovalLevel(levels);if(!current)return null;
 const prior=levels.filter(level=>level.position<current.position).at(-1)?.decidedAt;
 return prior??(typeof request.data.submittedAt==='string'?request.data.submittedAt:request.updatedAt??null);
}
/** Whole days a request has waited at its current level, and whether it passed the 72-hour mark. */
export function approvalWait(request:Pick<Entity,'status'|'data'>&{updatedAt?:string},now:Date){
 const since=waitingSince(request);if(!since)return null;
 const hours=Math.max(0,(now.getTime()-new Date(since).getTime())/36e5);
 return {since,days:Math.floor(hours/24),late:hours>=APPROVAL_ALERT_HOURS};
}

export const approvalUpdateNoticeSchema=z.object({
 type:z.literal('approval_update'),title:z.string().min(1).max(160),recipientId:uuid,requestId:uuid,tripId:uuid,entityKind:z.enum(['authorization','voucher']),entityId:uuid,
 destination:z.string().max(120).optional(),level:z.object({position:z.number().int().nonnegative(),label:z.string().min(1).max(80)}),
 decision:z.enum(['approved','changes_requested','rejected']),final:z.boolean(),nextLevel:z.string().max(80).optional(),comment:z.string().max(4000).optional(),decidedAt:z.string().datetime(),
});
export type ApprovalUpdateNotice=z.infer<typeof approvalUpdateNoticeSchema>;

export function approvalUpdateNotice(input:Omit<ApprovalUpdateNotice,'type'|'title'|'final'>&{final?:boolean}):ApprovalUpdateNotice{
 const kind=input.entityKind==='voucher'?'Voucher':'Authorization',final=input.decision!=='approved'||!input.nextLevel;
 const title=input.decision==='approved'?(final?`${kind} approved`:`Approved by ${input.level.label}`):input.decision==='changes_requested'?`Changes requested by ${input.level.label}`:`${kind} not approved by ${input.level.label}`;
 return approvalUpdateNoticeSchema.parse({...input,type:'approval_update',title,final,...(input.comment?.trim()?{comment:input.comment.trim()}:{comment:undefined})});
}
export function approvalUpdateSummary(notice:ApprovalUpdateNotice){
 if(notice.decision==='approved')return notice.final?`Fully approved at ${notice.level.label}. You can prepare your voucher.`:`${notice.level.label} approved it. Now with ${notice.nextLevel}.`;
 if(notice.decision==='changes_requested')return `${notice.level.label} sent it back for changes. Update your plan and submit again.`;
 return `${notice.level.label} did not approve this request.`;
}
