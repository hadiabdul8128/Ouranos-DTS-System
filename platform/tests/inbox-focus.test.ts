import {describe,it,expect} from 'vitest';
import type {Entity} from '../../packages/contracts';
import {inboxFocus,inboxMessageHref} from '../../components/inbox/inbox-focus';
const messages:Entity[]=[{id:'one',organizationId:'org',kind:'notification',version:1,status:'unread',updatedAt:'2026-10-07T12:00:00Z',data:{type:'authorization_submitted',authorizationId:'plan'}},{id:'two',organizationId:'org',kind:'notification',version:1,status:'read',updatedAt:'2026-10-07T13:00:00Z',data:{type:'approval_update'}}];
describe('inbox deep links',()=>{
 it('opens the chosen update ahead of an authorization link',()=>expect(inboxFocus(messages,'two','plan')?.id).toBe('two'));
 it('preserves the submission confirmation deep link',()=>expect(inboxFocus(messages,null,'plan')?.id).toBe('one'));
 it('only opens messages present in the scoped list',()=>expect(inboxFocus(messages,'another-recipient',null)).toBeUndefined());
 it('encodes the message identifier without introducing query parameters',()=>{
  const url=new URL(inboxMessageHref('one&authorization=other'),'http://localhost');
  expect(url.searchParams.get('message')).toBe('one&authorization=other');
  expect(url.searchParams.has('authorization')).toBe(false);
 });
});
