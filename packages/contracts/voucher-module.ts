import {z} from 'zod';
import {dateOnly,uuid} from './index';

/** Versioned platform boundary for the collaborator's Voucher Copilot module. */
export const VOUCHER_MODULE_SCHEMA_VERSION='ouranos.voucher.v1';

const minorUnits=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const uniqueDocumentIds=z.array(uuid).max(30).refine(ids=>new Set(ids).size===ids.length,'Duplicate receipt reference');

export const voucherExpenseItemSchema=z.object({
 expenseId:uuid,
 authorizationItemId:uuid,
 amountMinor:minorUnits.refine(value=>value>0,'Expense amount must be positive'),
 currency:z.literal('USD'),
 documentIds:uniqueDocumentIds,
}).strict();

export const voucherResolutionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('explanation'),value:z.string().trim().min(8).max(4000),at:z.string().datetime({offset:true}).optional()}).strict(),
 z.object({type:z.literal('confirmed_date'),value:dateOnly,at:z.string().datetime({offset:true}).optional()}).strict(),
 z.object({type:z.literal('not_used'),value:uuid,at:z.string().datetime({offset:true}).optional()}).strict(),
 z.object({type:z.literal('lost_receipt_statement'),value:z.object({reason:z.string().trim().min(8).max(2000),expenseVersion:z.number().int().positive()}).strict(),at:z.string().datetime({offset:true}).optional()}).strict(),
]);

/**
 * This validates the module's submission shape and internal arithmetic only.
 * The command API must compare every reference and amount with authoritative
 * records, verify approved authorization/document status, and recompute the
 * application's reconciliation rules against the frozen approved revision.
 * A client-provided empty issue list does not establish travel-policy approval.
 */
const voucherFields={
 tripId:uuid,
 authorizationId:uuid,
 currency:z.literal('USD'),
 certified:z.literal(true),
 intakeComplete:z.literal(true),
 expenseItems:z.array(voucherExpenseItemSchema).min(1).max(500),
 resolutions:z.record(z.string().min(1).max(240),voucherResolutionSchema).default({}),
};
const checkArithmetic=(value:{expenseItems:Array<{expenseId:string;amountMinor:number}>;reconciliation:{totalAmountMinor:number}},context:z.RefinementCtx)=>{
 const seen=new Set<string>();let total=BigInt(0);
 for(const [index,item] of value.expenseItems.entries()){
  if(seen.has(item.expenseId))context.addIssue({code:z.ZodIssueCode.custom,path:['expenseItems',index,'expenseId'],message:'Duplicate expense reference'});
  seen.add(item.expenseId);
  // Zod can invoke refinements after a numeric issue; avoid throwing on a
  // fractional or unsafe value and leave that error with its original field.
  if(!Number.isSafeInteger(item.amountMinor)||item.amountMinor<=0)return;
  total+=BigInt(item.amountMinor);
 }
 if(total>BigInt(Number.MAX_SAFE_INTEGER))context.addIssue({code:z.ZodIssueCode.custom,path:['reconciliation','totalAmountMinor'],message:'Combined expenses exceed the supported amount range'});
 else if(Number(total)!==value.reconciliation.totalAmountMinor)context.addIssue({code:z.ZodIssueCode.custom,path:['reconciliation','totalAmountMinor'],message:'Voucher total must equal the sum of its expense amounts'});
};

/** A verification attempt can include open issues. Only a verified submission
 * may use the stricter module schema below. The server recomputes every issue. */
export const voucherVerificationCandidateSchema=z.object({...voucherFields,reconciliation:z.object({
 totalAmountMinor:minorUnits,
 unresolvedIssueIds:z.array(z.string().min(1).max(240)).max(500),
}).strict()}).strict().superRefine(checkArithmetic);

export const voucherModuleSchema=z.object({...voucherFields,reconciliation:z.object({
 totalAmountMinor:minorUnits,
 unresolvedIssueIds:z.array(z.string().min(1).max(240)).max(0,'Resolve all voucher issues before submitting'),
}).strict()}).strict().superRefine(checkArithmetic);

export type VoucherModuleInput=z.infer<typeof voucherModuleSchema>;
