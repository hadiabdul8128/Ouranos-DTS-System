import {describe,expect,it} from 'vitest';
import {personalStateInput,personalStateQuery} from '../../packages/contracts/personal-state';

describe('personal workspace state contracts',()=>{
 const organizationId='00000000-0000-4000-8000-000000000001';
 it('accepts only the private state surfaces exposed by the app',()=>{
  for(const key of ['planner','preferences','voucher_documents'])expect(personalStateQuery.safeParse({organizationId,key}).success).toBe(true);
  expect(personalStateQuery.safeParse({organizationId,key:'admin'}).success).toBe(false);
 });
 it('bounds stored JSON',()=>{
  expect(personalStateInput.safeParse({organizationId,key:'preferences',value:{origin:'Boston, MA'}}).success).toBe(true);
  expect(personalStateInput.safeParse({organizationId,key:'preferences',value:{data:'x'.repeat(260_000)}}).success).toBe(false);
 });
});
