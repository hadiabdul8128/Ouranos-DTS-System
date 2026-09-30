import {z} from 'zod';
export const companionInput = z.object({
 organizationId:z.string().uuid(),
 messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(2000)}).strict()).min(1).max(10),
}).strict().refine(value=>value.messages.at(-1)?.role==='user','End with a question');

