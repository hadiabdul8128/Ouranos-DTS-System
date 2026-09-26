import {z} from 'zod';
// USD cents throughout the domain and API. UI strings are parsed separately.
export const financialMoneySchema=z.number().int().min(0).max(1_000_000_000);
export const financialMonthSchema=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/,'Use a month in YYYY-MM format');
export const financialProfileSchema=z.object({
 currency:z.literal('USD'),
 takeHomePerPaycheckMinor:financialMoneySchema,
 cadence:z.enum(['monthly','twice_monthly','biweekly','weekly']),
 tspPerPaycheckMinor:financialMoneySchema.default(0),
 expenses:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),monthlyAmountMinor:financialMoneySchema}).strict()).max(25).refine(v=>new Set(v.map(e=>e.id)).size===v.length,'Expense IDs must be unique'),
 monthlySpendingMinor:financialMoneySchema,
 emergency:z.object({balanceMinor:financialMoneySchema,targetMinor:financialMoneySchema,monthlyContributionMinor:financialMoneySchema}).strict(),
 goal:z.object({kind:z.enum(['separation','education','home','other']),name:z.string().trim().min(1).max(100),balanceMinor:financialMoneySchema,targetMinor:financialMoneySchema.refine(v=>v>0,'Enter a goal above $0'),monthlyContributionMinor:financialMoneySchema,targetMonth:financialMonthSchema.nullable()}).strict(),
 separationMonth:financialMonthSchema.nullable(),
 surplusPriority:z.enum(['emergency_first','goal_first','keep_available']).default('emergency_first'),
}).strict();
export type FinancialProfile=z.infer<typeof financialProfileSchema>;
export const financialAllocationSchema=z.object({id:z.enum(['essentials','spending','emergency','goal','buffer']),label:z.string(),monthlyMinor:z.number().int().nonnegative(),perPaycheckMinor:z.number().int().nonnegative()}).strict();
export const financialCalculationSchema=z.object({
 ruleVersion:z.literal('financial-readiness-v1'),asOfMonth:financialMonthSchema,
 regularPaychecksPerMonth:z.number().int().positive(),averageMonthlyTakeHomeMinor:z.number().int().nonnegative(),
 annualPaychecks:z.number().int().positive(),monthlyTakeHomeMinor:z.number().int().nonnegative(),monthlyTspMinor:z.number().int().nonnegative(),
 monthlyEssentialsMinor:z.number().int().nonnegative(),monthlyCommittedMinor:z.number().int().nonnegative(),monthlyUnassignedMinor:z.number().int(),monthlyDeficitMinor:z.number().int().nonnegative(),
 emergencyTopUpMinor:z.number().int().nonnegative(),goalTopUpMinor:z.number().int().nonnegative(),
 effectiveGoalMonth:financialMonthSchema.nullable(),monthsToGoal:z.number().int().nonnegative().nullable(),monthsToSeparation:z.number().int().nonnegative().nullable(),
 goalProgressPercent:z.number().min(0).max(100),goalGapMinor:z.number().int().nonnegative(),requiredMonthlyGoalMinor:z.number().int().nonnegative().nullable(),additionalMonthlyGoalMinor:z.number().int().nonnegative().nullable(),
 baselineForecastMinor:z.number().int().nonnegative().nullable(),suggestedForecastMinor:z.number().int().nonnegative().nullable(),
 goalStatus:z.enum(['reached','overdue','due_now','no_deadline','on_track','behind','budget_shortfall']),
 allocations:z.array(financialAllocationSchema),
 perPaycheckRequiredMinor:z.number().int().nonnegative(),perPaycheckDeficitMinor:z.number().int().nonnegative(),
}).strict();
export type FinancialCalculation=z.infer<typeof financialCalculationSchema>;
export const financialCheckInSchema=z.object({month:financialMonthSchema,goalName:z.string(),goalBalanceMinor:financialMoneySchema,emergencyBalanceMinor:financialMoneySchema,updatedAt:z.string().datetime()}).strict();
export const financialPlanSchema=z.object({
 id:z.string().uuid(),organizationId:z.string().uuid(),version:z.number().int().positive(),profile:financialProfileSchema,
 calculation:financialCalculationSchema,checkIns:z.array(financialCheckInSchema).max(24),updatedAt:z.string().datetime(),
}).strict();
export type FinancialPlan=z.infer<typeof financialPlanSchema>;
export const financialSaveSchema=z.object({organizationId:z.string().uuid(),requestId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),recordCheckIn:z.boolean().default(false),profile:financialProfileSchema}).strict();
export type FinancialSave=z.infer<typeof financialSaveSchema>;
