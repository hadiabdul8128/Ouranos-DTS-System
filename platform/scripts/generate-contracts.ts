import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {
  CONTRACT_VERSION, uuid, roleSchema, entityKindSchema, errorCodes,
  tripInput, authorizationInput, expenseInput, voucherInput, documentInput,
  workflowInput, commandSchema, syncPushSchema, organizationInput, membershipInput,
} from '../../packages/contracts/index';

import {transitionProfileSchema,transitionRecommendationSchema,transitionPlanSchema,transitionSaveSchema} from '../../packages/contracts/transition';

import {financialProfileSchema,financialCalculationSchema,financialPlanSchema,financialSaveSchema} from '../../packages/contracts/financial-readiness';

// Request schemas come directly from the runtime validators. Response schemas
// describe the serialized interfaces and rows returned by platform/api/app.ts.
const record = z.record(z.unknown());
const timestamp = z.string().datetime({offset: true});
const cursor = z.string().regex(/^\d+$/);
const apiError = z.object({code:z.enum(errorCodes), message:z.string(), requestId:z.string().optional(), details:z.unknown().optional()});
const entity = z.object({id:uuid, organizationId:uuid, tripId:uuid.nullable().optional(), kind:entityKindSchema, version:z.number().int().positive(), status:z.string(), data:record, updatedAt:timestamp});
const commandSuccess = z.object({commandId:uuid, ok:z.literal(true), entity, replayed:z.boolean().optional()});
const commandFailure = z.object({commandId:uuid, ok:z.literal(false), error:apiError});
const commandResult = z.union([commandSuccess, commandFailure]);
const revision = z.object({id:uuid, organization_id:uuid, trip_id:uuid, authorization_id:uuid.nullable(), voucher_id:uuid.nullable(), entity_version:z.number().int(), snapshot:record, sha256:z.string(), submitted_by:uuid, created_at:timestamp}).passthrough();
const approvalStep = z.object({id:uuid, organization_id:uuid, request_id:uuid, position:z.number().int(), assignee_id:uuid, required_role:z.enum(['reviewer','approver']), status:z.enum(['pending','approved','changes_requested','rejected'])}).passthrough();
const approvalDecision = z.object({id:uuid, organization_id:uuid, request_id:uuid, step_id:uuid, actor_id:uuid, decision:z.enum(['approved','changes_requested','rejected']), comment:z.string(), created_at:timestamp}).passthrough();

const models = {
  FinancialProfile:financialProfileSchema,FinancialCalculation:financialCalculationSchema,FinancialSave:financialSaveSchema,FinancialPlan:financialPlanSchema,FinancialResponse:z.object({plan:financialPlanSchema}),FinancialOptionalResponse:z.object({plan:financialPlanSchema.nullable()}),
  TransitionProfile:transitionProfileSchema,TransitionRecommendation:transitionRecommendationSchema,TransitionSave:transitionSaveSchema,TransitionPlan:transitionPlanSchema,
  TransitionResponse:z.object({plan:transitionPlanSchema}),TransitionOptionalResponse:z.object({plan:transitionPlanSchema.nullable()}),
  Role:roleSchema, EntityKind:entityKindSchema, TripInput:tripInput,
  AuthorizationInput:authorizationInput, ExpenseInput:expenseInput,
  VoucherInput:voucherInput, DocumentInput:documentInput, WorkflowInput:workflowInput,
  OrganizationInput:organizationInput, MembershipInput:membershipInput,
  Command:commandSchema, SyncPushInput:syncPushSchema,
  ApiError:apiError, ErrorResponse:z.object({error:apiError}), Entity:entity,
  CommandSuccess:commandSuccess, CommandFailure:commandFailure, CommandResult:commandResult,
  Session:z.object({approvalMode:z.enum(['required','preview','automatic']).optional(),user:z.object({id:uuid,email:z.string().optional()}), memberships:z.array(z.object({organizationId:uuid,name:z.string(),role:roleSchema})), contractVersion:z.string()}),
  EntityResponse:z.object({entity}), EntityList:z.object({entities:z.array(entity)}),
  Bootstrap:z.object({entities:z.array(entity),cursor}),
  SyncPushResult:z.object({results:z.array(commandResult)}),
  SyncPage:z.object({changes:z.array(z.object({cursor,kind:entityKindSchema,entityId:uuid,operation:z.enum(['upsert','delete']),entity:entity.nullable()})),cursor,hasMore:z.boolean()}),
  RevisionResponse:z.object({revision,steps:z.array(approvalStep),decisions:z.array(approvalDecision)}),
  AuditResponse:z.object({events:z.array(z.object({id:cursor,action:z.string(),actor_id:uuid.nullable(),entity_id:uuid,details:record,created_at:timestamp}))}),
  DocumentScope:z.object({organizationId:uuid}),
  UploadResponse:z.object({documentId:uuid,path:z.string(),token:z.string(),signedUrl:z.string().url()}),
  DownloadResponse:z.object({url:z.string().url(),expiresIn:z.literal(60)}),
  ExtractionResponse:z.object({runs:z.array(z.object({id:uuid,provider:z.string(),model_version:z.string(),result:record,created_at:timestamp}))}),
  CreatedOrganization:z.object({id:uuid,name:z.string()}),
  MembershipUpdated:z.object({updated:z.literal(true)}),
  Health:z.object({status:z.literal('ok'),contractVersion:z.string()}),
  Ready:z.object({status:z.literal('ready')}),
  TravelPackage:record,
  ApprovedAuthorization:z.object({revision:z.object({id:uuid,sha256:z.string(),snapshot:z.object({entity,trip:entity}).passthrough()})}),
  VoucherVerification:z.object({report:z.object({status:z.enum(['verified','needs_action']),checkedAt:timestamp,ruleVersion:z.string(),voucherId:uuid,tripId:uuid,authorizationId:uuid,authorizationRevisionId:uuid,voucherRevisionId:uuid,snapshotSha256:z.string(),expenseCount:z.number().int(),receiptCount:z.number().int(),checksPassed:z.number().int(),claimedTotalMinor:z.number().int(),gtccTotalMinor:z.number().int(),personalFundsTotalMinor:z.number().int(),documentIds:z.array(uuid),checks:z.array(record),warnings:z.array(z.string()),blockingIssues:z.array(record),reconciliation:record}).passthrough(),revision:z.object({id:uuid,sha256:z.string(),snapshot:record,createdAt:timestamp})}),
};

type SchemaName = keyof typeof models;
type SpecObject = Record<string, unknown>;
const ref = (name:SchemaName):SpecObject => ({$ref:`#/components/schemas/${name}`});
const json = (schema:SpecObject) => ({'application/json':{schema}});
const response = (name:SchemaName, description='Success') => ({description,content:json(ref(name))});
const request = (name:SchemaName) => ({required:true,content:json(ref(name))});
const pathId = {name:'id',in:'path',required:true,schema:{type:'string',format:'uuid'}};
const kind = {name:'kind',in:'path',required:true,schema:ref('EntityKind')};
const organization = {name:'organizationId',in:'query',required:true,schema:{type:'string',format:'uuid'}};
const limit = {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:500,default:100}};
const cursorQuery = {name:'cursor',in:'query',schema:{type:'string',pattern:'^\\d+$',default:'0'}};
const error = response('ErrorResponse','Request could not be completed. Inspect error.code; error.details may be absent.');

function operation(operationId:string, summary:string, result:SchemaName, extra:SpecObject={}):SpecObject {
  return {operationId,summary,responses:{'200':response(result),'401':error,'429':error,default:error},...extra};
}
const commandError = {description:'Command rejected. Domain failures include commandId and ok:false; request/database failures use the error envelope.',content:json({oneOf:[ref('CommandFailure'),ref('ErrorResponse')]})};
const paths:Record<string,Record<string,SpecObject>> = {
  '/health':{get:operation('health','Process health','Health',{security:[]})},
  '/ready':{get:operation('ready','Database connectivity','Ready',{security:[]})},
  '/openapi.json':{get:{operationId:'openapi',summary:'This generated OpenAPI document',security:[],responses:{'200':{description:'OpenAPI 3.0 document',content:json({type:'object',additionalProperties:true})},default:error}}},
  '/v1/transition/plan':{get:operation('transitionPlan','Read the caller’s private transition plan','TransitionOptionalResponse',{parameters:[organization]}),put:operation('saveTransitionPlan','Save answers, selected path, and action progress','TransitionResponse',{description:'Owner-only personal plan. expectedVersion is 0 for first save and the last saved version otherwise. Reuse requestId with identical input to retry. The server generates recommendations; the caller cannot supply them. This plan is excluded from shared travel synchronization.',requestBody:request('TransitionSave')})},
  '/v1/financial-readiness/plan':{get:operation('financialPlan','Read the caller’s private budget, calculated plan, and check-ins','FinancialOptionalResponse',{parameters:[organization]}),put:operation('saveFinancialPlan','Save a private financial plan or balance check-in','FinancialResponse',{description:'USD cents. Server-generated planning arithmetic, no money movement. Payroll TSP is informational and excluded from net-pay spending deductions. Versions detect concurrent edits. Reuse requestId with identical input for retries. recordCheckIn confirms the current month balances; changing balance amounts requires it. Returns at most 24 monthly check-ins. Calculations on GET refresh to the current UTC month without assuming balances grew.',requestBody:request('FinancialSave')})},
  '/v1/session':{get:operation('session','Verified user and active organization memberships','Session')},
  '/v1/organizations':{post:operation('createOrganization','Create an organization with the caller as administrator','CreatedOrganization',{requestBody:request('OrganizationInput'),responses:{'201':response('CreatedOrganization','Created'),'401':error,default:error}})},
  '/v1/organizations/{id}/members':{put:operation('setMembership','Administrator assigns an existing user a role','MembershipUpdated',{description:'The caller cannot change their own membership. The target user must already exist in Supabase Auth.',parameters:[pathId],requestBody:request('MembershipInput')})},
  '/v1/commands':{post:operation('executeCommand','Execute one versioned, idempotent command','CommandSuccess',{
    description:'Use commandId in the body as the idempotency key; the Idempotency-Key HTTP header is not read. Reuse the entire unchanged command when retrying a lost response. expectedVersion is 0 for creation and the current entity version for updates. A deviceId belongs to one user in one organization. Custom date/order, duplicate-expense and final-approver refinements are enforced by Zod at runtime in addition to the generated JSON Schema.',
    requestBody:request('Command'),responses:{'200':response('CommandSuccess'),'400':error,'401':error,'403':commandError,'409':commandError,'422':commandError,'429':error,default:error},
  })},
  '/v1/sync/push':{post:operation('pushCommands','Execute an ordered batch of up to 50 commands','SyncPushResult',{description:'Commands commit independently; inspect every result. This is not an all-or-nothing transaction. A request-level failure may occur after earlier commands committed; retry identical envelopes.',requestBody:request('SyncPushInput')})},
  '/v1/sync/pull':{get:operation('pullChanges','Read visible changes after a cursor','SyncPage',{description:'Cursor values are decimal strings, not JavaScript numbers. Visibility is evaluated for the authenticated user. Use bootstrap to reconcile records that are no longer visible.',parameters:[organization,cursorQuery,limit]})},
  '/v1/sync/bootstrap':{get:operation('bootstrap','Load the currently visible workspace snapshot','Bootstrap',{description:'Returns at most 2,000 records per entity kind; a larger visible set returns DEPENDENCY_PENDING. Replace server-confirmed cached records absent from this snapshot while retaining pending local drafts for explicit resolution.',parameters:[organization]})},
  '/v1/entities/{kind}':{get:operation('listEntities','List visible entities of one kind','EntityList',{description:'Sorted by updated_at descending, then id. limit is supported; cursor is currently ignored for this route. Use sync/pull for cursor-based change retrieval.',parameters:[kind,organization,limit]})},
  '/v1/entities/{kind}/{id}':{get:operation('getEntity','Load one visible entity','EntityResponse',{parameters:[kind,pathId,organization]})},
  '/v1/approvals/{id}/revision':{get:operation('approvalRevision','Read an immutable submission and its approval history','RevisionResponse',{description:'The id is an approval request id. The returned revision, steps and decisions retain database snake_case field names.',parameters:[pathId,organization]})},
  '/v1/authorizations/{id}/approved':{get:operation('approvedAuthorization','Load the approved immutable authorization for a voucher','ApprovedAuthorization',{parameters:[pathId,organization]})},
  '/v1/authorizations/{id}/working':{get:operation('workingAuthorization','Load a current working plan in preview mode only','ApprovedAuthorization',{parameters:[pathId,organization]})},
  '/v1/vouchers/{id}/package':{get:operation('voucherPackage','Read a frozen submission and DTS preparation package','TravelPackage',{parameters:[pathId,organization]})},
  '/v1/vouchers/{id}/verification':{get:operation('voucherVerification','Read the latest immutable Voucher verification report and frozen submission','VoucherVerification',{parameters:[pathId,organization]})},
  '/v1/trips/{id}/audit':{get:operation('tripAudit','Read up to 500 trip audit events','AuditResponse',{description:'Events are ordered by ascending id. This endpoint does not provide pagination.',parameters:[pathId,organization]})},
  '/v1/documents/{id}/upload':{post:operation('prepareUpload','Create a signed upload URL for a registered document','UploadResponse',{description:'Only the document creator may upload while status is registered. Upload bytes to signedUrl, then issue document.finalize. Finalization verifies the stored size, media signature and SHA-256 digest.',parameters:[pathId],requestBody:request('DocumentScope')})},
  '/v1/documents/{id}/download':{post:operation('prepareDownload','Create a short-lived signed download URL','DownloadResponse',{description:'Requires document status needs_review or ready and current trip visibility. The URL expires after 60 seconds.',parameters:[pathId],requestBody:request('DocumentScope')})},
  '/v1/documents/{id}/extractions':{get:operation('documentExtractions','Read receipt extraction history','ExtractionResponse',{parameters:[pathId,organization]})},
};

const schemas = Object.fromEntries(Object.entries(models).map(([name,schema])=>{
  const converted = zodToJsonSchema(schema,{target:'openApi3',$refStrategy:'none'});
  return [name,converted];
}));
const document = {
  openapi:'3.0.3',
  info:{title:'Ouranos platform API',version:CONTRACT_VERSION,description:'Connected travel platform. Supabase bearer authentication, organization isolation, versioned commands, synchronization, human Authorization approval, and immutable automatic Voucher verification. A successful Ouranos verification is not DTS acceptance or DoD approval.'},
  servers:[{url:'http://localhost:4100',description:'Local development; replace with your configured API origin.'}],
  security:[{bearerAuth:[]}],
  paths,
  components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'Supabase access token'}},schemas},
};

// Prevent route additions/renames from silently disappearing from the handoff.
const apiSource = (await Promise.all(['app.ts','transition.ts','financial-readiness.ts'].map(file=>readFile(new URL(`../api/${file}`,import.meta.url),'utf8')))).join('\n');
const implemented = [...apiSource.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)].map(([,method,path])=>`${method} ${path.replace(/:([A-Za-z]+)/g,'{$1}')}`).sort();
const documented = Object.entries(paths).flatMap(([path,methods])=>Object.keys(methods).map(method=>`${method} ${path}`)).sort();
if(JSON.stringify(implemented)!==JSON.stringify(documented))throw new Error('API route inventory differs from OpenAPI. Update generate-contracts.ts before generating.');

const output = `${JSON.stringify(document,null,2)}\n`;
const target = new URL('../../docs/openapi.json',import.meta.url);
if(process.argv.includes('--check')){
  if(await readFile(target,'utf8')!==output)throw new Error('docs/openapi.json is stale. Run npm run platform:contracts.');
  console.log(`OpenAPI is current: ${documented.length} operations, ${Object.keys(schemas).length} schemas.`);
}else{
  await mkdir(new URL('../../docs/',import.meta.url),{recursive:true});
  await writeFile(target,output);
  console.log(`Generated docs/openapi.json: ${documented.length} operations, ${Object.keys(schemas).length} schemas.`);
}
