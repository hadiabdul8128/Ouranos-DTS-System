import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuthorizationMessage} from '../../components/inbox/authorization-message';
import {describe,it,expect} from 'vitest';
import {authorizationNoticeSchema,authorizationSubmissionNotice,inboxMessages} from '../../packages/contracts/authorization-notice';
import type {Entity} from '../../packages/contracts';
const org='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002',tripId='00000000-0000-4000-8000-000000000003',authId='00000000-0000-4000-8000-000000000004',requestId='00000000-0000-4000-8000-000000000005',revisionId='00000000-0000-4000-8000-000000000006';
const trip:Entity={id:tripId,organizationId:org,kind:'trip',version:1,status:'draft',updatedAt:'2026-10-01T10:00:00.000Z',data:{destination:'San Diego, CA',departure:'2026-10-12',returnDate:'2026-10-15',purpose:'Training',timezone:'America/New_York'}};
const authorization:Entity={...trip,id:authId,kind:'authorization',tripId,data:{formSchemaVersion:'ouranos.planning.v1',formData:{traveler:'Traveler',origin:'Raleigh, NC',currency:'USD',approvedExpenseItems:[{id:requestId,category:'lodging',description:'Hotel',authorizedAmountMinor:57000,merchant:'Marriott',startDate:'2026-10-12',endDate:'2026-10-15',expectedPaymentMethod:'gtcc'}]}}};
describe('authorization inbox confirmation',()=>{
 it('shows the frozen combined total and an explicit included meals estimate',()=>{
  const withMeals={...authorization,data:{...authorization.data,formData:{...authorization.data.formData as object,allowance:{enabled:true,governmentMess:false,mealsProvided:{}}}}};
  const notice=authorizationSubmissionNotice({authorization:withMeals,trip,recipientId:user,requestId,revisionId,submittedAt:trip.updatedAt,budget:{expensesMinor:57000,mealsMinor:52000,totalMinor:109000,mealsIncluded:true}});
  const html=renderToStaticMarkup(createElement(AuthorizationMessage,{notice}));
  expect(html).toContain('$1,090.00');expect(html).toContain('$520.00 included');
  expect(notice.submission.budget?.totalMinor).toBe(109000);
 });
 it('includes the full submitted trip and form with the immutable revision reference',()=>{
  const notice=authorizationSubmissionNotice({authorization,trip,recipientId:user,requestId,revisionId,submittedAt:trip.updatedAt});
  expect(notice).toMatchObject({type:'authorization_submitted',authorizationId:authId,tripId,recipientId:user,requestId,revisionId,submission:{trip:trip.data,formData:authorization.data.formData}});
  expect(authorizationNoticeSchema.safeParse(notice).success).toBe(true);
 });
 it('renders all submitted expense details and a link to the same authorization',()=>{
  const notice=authorizationSubmissionNotice({authorization,trip,recipientId:user,requestId,revisionId,submittedAt:trip.updatedAt});
  const html=renderToStaticMarkup(createElement(AuthorizationMessage,{notice}));
  for(const text of ['Traveler','Raleigh, NC','San Diego, CA','Training','Marriott','$570.00','Government travel card','Oct 12, 2026','Oct 15, 2026','Complete submitted record'])expect(html).toContain(text);
  expect(html).toContain(`/dashboard/travel/planning?tripId=${tripId}`);
  expect(html).toContain('submission does not mean approval');
 });
 it('does not treat an old notification or malformed submission as a complete authorization',()=>{
  expect(authorizationNoticeSchema.safeParse({title:'Submission approved',requestId,recipientId:user}).success).toBe(false);
  expect(authorizationNoticeSchema.safeParse({type:'authorization_submitted',tripId:'javascript:evil'}).success).toBe(false);
 });
 it('keeps submission messages in arrival order after they are marked read',()=>{
  const recent:Entity={...trip,id:requestId,kind:'notification',status:'unread',data:{recipientId:user,submittedAt:'2026-10-02T10:00:00.000Z'}};
  const older:Entity={...recent,id:revisionId,status:'read',updatedAt:'2026-10-03T10:00:00.000Z',data:{recipientId:user,submittedAt:'2026-10-01T10:00:00.000Z'}};
  expect(inboxMessages([older,recent],org,user).map(e=>e.id)).toEqual([requestId,revisionId]);
 });
 it('limits inbox and unread counts to the current user and workspace',()=>{
  const notification:Entity={...trip,id:requestId,kind:'notification',status:'unread',data:{title:'Authorization submitted',recipientId:user}};
  const read={...notification,id:revisionId,status:'read',updatedAt:'2026-10-01T09:00:00.000Z'};
  const all=[read,notification,{...notification,id:authId,data:{recipientId:revisionId}},{...notification,organizationId:revisionId},trip];
  const visible=inboxMessages(all,org,user);
  expect(visible.map(e=>e.id)).toEqual([requestId,revisionId]);expect(visible.filter(e=>e.status==='unread')).toHaveLength(1);
  expect(inboxMessages(all,null,user)).toEqual([]);expect(inboxMessages(all,org,undefined)).toEqual([]);
 });
});
