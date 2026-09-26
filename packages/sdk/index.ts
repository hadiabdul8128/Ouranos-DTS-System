import type {Command,CommandResult,Entity,EntityKind,SessionInfo,SyncPage,ApiError,Role} from '../contracts/index';
import type {ApprovedRevision} from '../domain/voucher-adapter';
import type {VerificationReport} from '../domain/voucher-verification';
import type {TransitionPlan,TransitionSave} from '../contracts/transition';
import type {FinancialPlan,FinancialSave} from '../contracts/financial-readiness';
export class ApiFailure extends Error {constructor(public status:number,public error:ApiError){super(error.message)}}
export class OuranosClient {
 constructor(public baseUrl:string,private accessToken:()=>Promise<string|null>){this.baseUrl=baseUrl.replace(/\/$/,'')}
 async request<T>(path:string,options:RequestInit={}):Promise<T>{
  const token=await this.accessToken();if(!token)throw new ApiFailure(401,{code:'AUTHENTICATION_REQUIRED',message:'Sign in to synchronize'});
  const response=await fetch(`${this.baseUrl}${path}`,{...options,signal:options.signal||AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...options.headers,Authorization:`Bearer ${token}`}});
  const body:any=await response.json();if(!response.ok)throw new ApiFailure(response.status,body.error||{code:'INTERNAL_ERROR',message:'Request failed'});return body;
 }
 financialPlan(organizationId:string){return this.request<{plan:FinancialPlan|null}>(`/v1/financial-readiness/plan?organizationId=${organizationId}`)}
 saveFinancialPlan(input:FinancialSave){return this.request<{plan:FinancialPlan}>('/v1/financial-readiness/plan',{method:'PUT',body:JSON.stringify(input)})}
 transitionPlan(organizationId:string){return this.request<{plan:TransitionPlan|null}>(`/v1/transition/plan?organizationId=${organizationId}`)}
 saveTransitionPlan(input:TransitionSave){return this.request<{plan:TransitionPlan}>('/v1/transition/plan',{method:'PUT',body:JSON.stringify(input)})}
 session(){return this.request<SessionInfo>('/v1/session')}
 createOrganization(name:string){return this.request<{id:string;name:string}>('/v1/organizations',{method:'POST',body:JSON.stringify({name})})}
 setMember(organizationId:string,userId:string,role:Role,active=true){return this.request(`/v1/organizations/${organizationId}/members`,{method:'PUT',body:JSON.stringify({userId,role,active})})}
 command(command:Command){return this.request<CommandResult>('/v1/commands',{method:'POST',body:JSON.stringify(command)})}
 push(commands:Command[]){return this.request<{results:CommandResult[]}>('/v1/sync/push',{method:'POST',body:JSON.stringify({commands})})}
 pull(organizationId:string,cursor='0'){return this.request<SyncPage>(`/v1/sync/pull?organizationId=${organizationId}&cursor=${cursor}`)}
 bootstrap(organizationId:string){return this.request<{entities:Entity[];cursor:string}>(`/v1/sync/bootstrap?organizationId=${organizationId}`)}
 list(kind:EntityKind,organizationId:string){return this.request<{entities:Entity[]}>(`/v1/entities/${kind}?organizationId=${organizationId}`)}
 get(kind:EntityKind,id:string,organizationId:string){return this.request<{entity:Entity}>(`/v1/entities/${kind}/${id}?organizationId=${organizationId}`)}
 revision(id:string,organizationId:string){return this.request<{revision:{id:string;snapshot:Record<string,unknown>;sha256:string};steps:unknown[];decisions:unknown[]}>(`/v1/approvals/${id}/revision?organizationId=${organizationId}`)}
 approvedAuthorization(id:string,organizationId:string){return this.request<{revision:ApprovedRevision}>(`/v1/authorizations/${id}/approved?organizationId=${organizationId}`)}
 workingAuthorization(id:string,organizationId:string){return this.request<{revision:ApprovedRevision}>(`/v1/authorizations/${id}/working?organizationId=${organizationId}`)}
 voucherPackage(id:string,organizationId:string){return this.request<import('../domain/travel-package').TravelPackage>(`/v1/vouchers/${id}/package?organizationId=${organizationId}`)}
 voucherVerification(id:string,organizationId:string){return this.request<{report:VerificationReport;revision:{id:string;sha256:string;snapshot:Record<string,unknown>;createdAt:string}}>(`/v1/vouchers/${id}/verification?organizationId=${organizationId}`)}
 prepareUpload(id:string,organizationId:string){return this.request<{documentId:string;path:string;token:string;signedUrl:string}>(`/v1/documents/${id}/upload`,{method:'POST',body:JSON.stringify({organizationId})})}
 download(id:string,organizationId:string){return this.request<{url:string;expiresIn:number}>(`/v1/documents/${id}/download`,{method:'POST',body:JSON.stringify({organizationId})})}
 extractions(id:string,organizationId:string){return this.request<{runs:unknown[]}>(`/v1/documents/${id}/extractions?organizationId=${organizationId}`)}
}
