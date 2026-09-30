import {z} from 'zod';

const organizationId=z.string().uuid();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const guideBuildInput=z.object({organizationId,instructions:z.string().trim().min(3).max(6000),today:day}).strict();
export const guideStepSchema=z.object({title:z.string().trim().min(1).max(160),detail:z.string().trim().max(800),due:day.nullable()}).strict();
export const guideChecklistSchema=z.object({title:z.string().trim().min(1).max(100),steps:z.array(guideStepSchema).min(1).max(20)}).strict();
export const guideAskInput=z.object({
 organizationId,
 checklist:z.object({title:z.string().max(100),steps:z.array(z.object({title:z.string().max(160),detail:z.string().max(800).optional(),done:z.boolean().optional()}).strict()).max(30)}).strict(),
 messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(2000)}).strict()).min(1).max(10),
}).strict().refine(value=>value.messages.at(-1)?.role==='user','End with a question');
export type GuideChecklist=z.infer<typeof guideChecklistSchema>;
