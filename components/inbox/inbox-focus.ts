import type {Entity} from '@/packages/contracts';
/** Select only from the caller's already-scoped inbox; never look up another recipient's message. */
export function inboxFocus(messages:Entity[],messageId:string|null,authorizationId:string|null){
 return messageId?messages.find(n=>n.id===messageId):authorizationId?messages.find(n=>n.data.type==='authorization_submitted'&&n.data.authorizationId===authorizationId):undefined;
}
export const inboxMessageHref=(id:string)=>`/dashboard/inbox?${new URLSearchParams({message:id})}`;
