import {z} from 'zod';

export const transitionPathIds=['employment','training','education'] as const;
export const transitionSkillIds=['leadership','operations','technical','people','analysis'] as const;
export const transitionProfileSchema=z.object({
 stage:z.enum(['preparing','recently_separated','veteran']),
 branch:z.enum(['army','navy','air_force','marine_corps','space_force','coast_guard','other','prefer_not_to_say']),
 militaryRole:z.string().trim().max(160).default(''),
 location:z.string().trim().min(1,'Enter the city or area where you want to live.').max(120),
 skills:z.array(z.enum(transitionSkillIds)).max(5).refine(v=>new Set(v).size===v.length,'Choose each skill once'),
 interests:z.string().trim().max(500).default(''),
 goal:z.enum(['job','training','education','exploring']),
 incomeTiming:z.enum(['now','soon','flexible']),
 housingSupport:z.boolean().default(false),
}).strict();
export type TransitionProfile=z.infer<typeof transitionProfileSchema>;
export type TransitionPathId=typeof transitionPathIds[number];
export type TransitionSkillId=typeof transitionSkillIds[number];

export const transitionActionSchema=z.object({id:z.string(),title:z.string(),detail:z.string(),resourceId:z.string()}).strict();
export const transitionPathSchema=z.object({
 id:z.enum(transitionPathIds),title:z.string(),summary:z.string(),reasons:z.array(z.string()),
 considerations:z.array(z.string()),actions:z.array(transitionActionSchema).length(3),
}).strict();
export const transitionRecommendationSchema=z.object({
 version:z.literal('transition-v1'),generatedAt:z.string().datetime(),
 method:z.literal('guided_rules'),paths:z.array(transitionPathSchema).length(3),
}).strict();
export type TransitionRecommendation=z.infer<typeof transitionRecommendationSchema>;
export type TransitionPath=z.infer<typeof transitionPathSchema>;

export const transitionSaveSchema=z.object({
 organizationId:z.string().uuid(),requestId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),
 profile:transitionProfileSchema,selectedPath:z.enum(transitionPathIds).nullable(),
 completedActionIds:z.array(z.string().min(1).max(80)).max(3).refine(v=>new Set(v).size===v.length,'Duplicate action'),
}).strict();
export type TransitionSave=z.infer<typeof transitionSaveSchema>;
export const transitionPlanSchema=z.object({
 id:z.string().uuid(),organizationId:z.string().uuid(),version:z.number().int().positive(),
 profile:transitionProfileSchema,recommendation:transitionRecommendationSchema,
 selectedPath:z.enum(transitionPathIds).nullable(),completedActionIds:z.array(z.string()),updatedAt:z.string().datetime(),
}).strict();
export type TransitionPlan=z.infer<typeof transitionPlanSchema>;
