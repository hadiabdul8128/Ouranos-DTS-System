import {z} from 'zod';
import {tripInput,uuid,type Entity} from './index';

/** A copy of what was submitted, never a projection of a later draft. */
export const authorizationNoticeSchema=z.object({
 type:z.literal('authorization_submitted'),title:z.literal('Authorization submitted'),
 recipientId:uuid,requestId:uuid,revisionId:uuid,authorizationId:uuid,tripId:uuid,
 submittedAt:z.string().datetime(),
 submission:z.object({trip:tripInput,formSchemaVersion:z.string(),formData:z.record(z.unknown())}),
});
export type AuthorizationNotice=z.infer<typeof authorizationNoticeSchema>;
export function authorizationSubmissionNotice(input:{authorization:Entity;trip:Entity;recipientId:string;requestId:string;revisionId:string;submittedAt:string}):AuthorizationNotice{
 return authorizationNoticeSchema.parse({type:'authorization_submitted',title:'Authorization submitted',recipientId:input.recipientId,requestId:input.requestId,revisionId:input.revisionId,authorizationId:input.authorization.id,tripId:input.trip.id,submittedAt:input.submittedAt,submission:{trip:input.trip.data,formSchemaVersion:input.authorization.data.formSchemaVersion,formData:input.authorization.data.formData}});
}

export function inboxMessages(entities:Entity[],organizationId:string|null,userId:string|undefined){
 if(!organizationId||!userId)return [];
 return entities.filter(e=>e.kind==='notification'&&e.organizationId===organizationId&&e.data.recipientId===userId).sort((a,b)=>receivedAt(b).localeCompare(receivedAt(a)));
}
function receivedAt(entity:Entity){
 const submitted=z.string().datetime().safeParse(entity.data.submittedAt??entity.data.decidedAt);
 return submitted.success?submitted.data:entity.updatedAt;
}
