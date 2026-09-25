import {z} from 'zod';
import {dateOnly, uuid} from './index';

export const PLANNING_SCHEMA_VERSION = 'ouranos.planning.v1';
export const travelCategories = ['airfare','lodging','rental_car','fuel','meals','parking','ground_transport','baggage','other'] as const;
export const plannedExpenseSchema = z.object({
  id:uuid, category:z.enum(travelCategories), description:z.string().trim().min(1).max(300),
  authorizedAmountMinor:z.number().int().positive().max(1_000_000_000),
  merchant:z.string().trim().max(200).optional(),
  expectedPaymentMethod:z.enum(['gtcc','personal']).optional(),
  date:dateOnly.optional(), startDate:dateOnly.optional(), endDate:dateOnly.optional(),
  nights:z.number().int().nonnegative().max(1000).optional(),
}).strict().refine(v=>Boolean(v.startDate)===Boolean(v.endDate)&&(!v.startDate||v.startDate<=v.endDate!), 'Stay dates must be an ordered pair');
export const planningModuleSchema = z.object({
  traveler:z.string().trim().min(1).max(200), origin:z.string().trim().min(1).max(120),
  currency:z.literal('USD'), approvedExpenseItems:z.array(plannedExpenseSchema).min(1).max(100),
}).strict().refine(v=>new Set(v.approvedExpenseItems.map(i=>i.id)).size===v.approvedExpenseItems.length, 'Budget item IDs must be unique');
export type PlanningModuleInput = z.infer<typeof planningModuleSchema>;
export type PlannedExpense = z.infer<typeof plannedExpenseSchema>;

// Parse the display value as decimal digits, never by multiplying a float.
export function parseAmountMinor(value:string):number {
  if(!/^\d+(\.\d{1,2})?$/.test(value.trim()))throw new Error('Use a positive amount with at most two decimal places.');
  const [whole,fraction='']=value.trim().split('.');
  const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1_000_000_000)throw new Error('Enter a valid positive amount.');
  return amount;
}
