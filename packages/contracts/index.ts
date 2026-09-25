import { z } from 'zod';

export const CONTRACT_VERSION = '1.0.0';
export const uuid = z.string().uuid();
const text = (max = 250) => z.string().trim().min(1).max(max);
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Invalid calendar date');
export const roleSchema = z.enum(['traveler', 'reviewer', 'approver', 'admin', 'auditor']);
export const tripInput = z.object({destination:text(120), departure:dateOnly, returnDate:dateOnly, purpose:text(2000), timezone:text(80).default('UTC')}).strict().refine(v=>v.returnDate>=v.departure,{path:['returnDate'],message:'Return must be on or after departure'});
export const authorizationInput = z.object({tripId:uuid, formSchemaVersion:text(50), formData:z.record(z.unknown())}).strict();
export const expenseInput = z.object({tripId:uuid, merchant:text(200), incurredOn:dateOnly, amountMinor:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currency:z.string().regex(/^[A-Z]{3}$/), category:z.enum(['airfare','lodging','rental_car','fuel','meals','parking','ground_transport','baggage','other','transport']), description:z.string().max(2000).default(''), documentIds:z.array(uuid).max(30).default([]), authorizationItemId:uuid.optional(), paymentMethod:z.enum(['gtcc','personal']).optional(), serviceStartDate:dateOnly.optional(), serviceEndDate:dateOnly.optional(), taxesMinor:z.number().int().nonnegative().max(1_000_000_000).optional(), feesMinor:z.number().int().nonnegative().max(1_000_000_000).optional(), bookedOnline:z.boolean().optional()}).strict().refine(v=>(v.taxesMinor||0)+(v.feesMinor||0)<=v.amountMinor,'Tax and fees cannot exceed the total').refine(v=>Boolean(v.serviceStartDate)===Boolean(v.serviceEndDate)&&(!v.serviceStartDate||v.serviceStartDate<v.serviceEndDate!),'Stay dates must be an ordered pair').refine(v=>v.category==='lodging'||(!v.taxesMinor&&!v.feesMinor&&!v.bookedOnline),'Lodging details only apply to lodging');
export const voucherInput = z.object({tripId:uuid, authorizationId:uuid, expenseIds:z.array(uuid).min(1).max(500).refine(a=>new Set(a).size===a.length,'Duplicate expense'), formSchemaVersion:text(50), formData:z.record(z.unknown())}).strict();
export const documentInput = z.object({tripId:uuid, filename:text(240), mediaType:z.enum(['image/jpeg','image/png','application/pdf']), byteSize:z.number().int().positive().max(20*1024*1024), sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const workflowInput = z.object({kind:z.enum(['authorization','voucher']), name:text(100), steps:z.array(z.object({assigneeId:uuid, role:z.enum(['reviewer','approver'])}).strict()).min(1).max(10)}).strict().refine(x=>x.steps[x.steps.length-1].role==='approver','The final step must be an approver');
const envelope = {commandId:uuid, organizationId:uuid, entityId:uuid, deviceId:uuid, schemaVersion:z.literal(1), expectedVersion:z.number().int().nonnegative()};
const command = <T extends string, S extends z.ZodTypeAny>(type:T,payload:S)=>z.object({...envelope,type:z.literal(type),payload}).strict();
export const commandSchema = z.discriminatedUnion('type',[
 command('trip.save',tripInput),
 command('authorization.save',authorizationInput),
 command('expense.save',expenseInput),
 command('voucher.save',voucherInput),
 command('document.register',documentInput),
 command('document.finalize',z.object({}).strict()),
 command('document.confirm',z.object({}).strict()),
 command('document.reprocess',z.object({}).strict()),
 command('authorization.submit',z.object({}).strict()),
 command('voucher.submit',z.object({}).strict()),
 command('approval.decide',z.object({decision:z.enum(['approved','changes_requested','rejected']),comment:z.string().max(4000).default('')}).strict()),
 command('workflow.configure',workflowInput),
 command('integration.request',z.object({kind:z.enum(['authorization','voucher'])}).strict()),
 command('notification.read',z.object({}).strict()),
]);
export type Command = z.infer<typeof commandSchema>;
export type CommandType = Command['type'];
export type PayloadOf<T extends CommandType> = Extract<Command,{type:T}>['payload'];
export type Role = z.infer<typeof roleSchema>;
export type TripInput = z.infer<typeof tripInput>;
export const entityKinds = ['trip','authorization','expense','voucher','document','approval','workflow','notification','integration'] as const;
export const entityKindSchema = z.enum(entityKinds);
export type EntityKind = z.infer<typeof entityKindSchema>;
export const errorCodes = ['VALIDATION_FAILED','VERSION_CONFLICT','PERMISSION_DENIED','AUTHENTICATION_REQUIRED','NOT_FOUND','ATTACHMENT_INCOMPLETE','INVALID_STATE_TRANSITION','IDEMPOTENCY_CONFLICT','DEPENDENCY_PENDING','PROVIDER_UNAVAILABLE','RATE_LIMITED','INTERNAL_ERROR'] as const;
export type ErrorCode = typeof errorCodes[number];
export interface ApiError {code:ErrorCode;message:string;requestId?:string;details?:unknown}
export interface Entity {id:string; organizationId:string; tripId?:string; kind:EntityKind; version:number; status:string; data:Record<string,unknown>; updatedAt:string}
export type CommandResult = {commandId:string;ok:true;entity:Entity;replayed?:boolean}|{commandId:string;ok:false;error:ApiError};
export const syncPushSchema = z.object({commands:z.array(commandSchema).min(1).max(50)}).strict();
export interface Change {cursor:string;kind:EntityKind;entityId:string;operation:'upsert'|'delete';entity:Entity|null}
export interface SyncPage {changes:Change[];cursor:string;hasMore:boolean}
export const organizationInput = z.object({name:text(120)}).strict();
export const membershipInput = z.object({userId:uuid,role:roleSchema,active:z.boolean().default(true)}).strict();
export interface SessionInfo {user:{id:string;email?:string};memberships:Array<{organizationId:string;name:string;role:Role}>;contractVersion:string}
