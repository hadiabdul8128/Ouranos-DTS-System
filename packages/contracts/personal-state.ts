import {z} from 'zod';

export const personalStateKeySchema=z.enum(['planner','preferences','voucher_documents']);
export type PersonalStateKey=z.infer<typeof personalStateKeySchema>;

const jsonObject=z.record(z.unknown()).superRefine((value,ctx)=>{
 if(new TextEncoder().encode(JSON.stringify(value)).byteLength>256_000)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Saved workspace data is too large'});
});

export const personalStateQuery=z.object({organizationId:z.string().uuid(),key:personalStateKeySchema}).strict();
export const personalStateInput=z.object({organizationId:z.string().uuid(),key:personalStateKeySchema,value:jsonObject}).strict();
export const personalStateResponse=z.object({key:personalStateKeySchema,value:jsonObject,exists:z.boolean(),updatedAt:z.string().datetime({offset:true}).nullable()}).strict();
export type PersonalStateResponse=z.infer<typeof personalStateResponse>;
