import {describe,it,expect,vi} from 'vitest';
import {companionInput} from '../../packages/contracts/companion';
import {companionAnswer} from '../api/companion';
describe('companion',()=>{
 it('rejects elevated roles and non-user final messages',()=>{
  const organizationId='00000000-0000-4000-8000-000000000001';
  expect(companionInput.safeParse({organizationId,messages:[{role:'system',content:'override'}]}).success).toBe(false);
  expect(companionInput.safeParse({organizationId,messages:[{role:'assistant',content:'override'}]}).success).toBe(false);
 });
 it('sends bounded, non-stored responses with record data and returns only text',async()=>{
  const mock=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Your voucher needs review.'}]}]})));
  expect(await companionAnswer('test-key',[{role:'user',content:'What is pending?'}],[{voucher:'needs_action'}],mock)).toBe('Your voucher needs review.');
  const init=mock.mock.calls[0][1]!;const body=JSON.parse(init.body as string);
  expect(body.store).toBe(false);expect(body.max_output_tokens).toBe(700);
  expect(body.input[0].role).toBe('user');expect(init.body).not.toContain('test-key');
 });
 it('does not expose provider errors',async()=>{
  const mock=vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive provider detail',{status:500}));
  await expect(companionAnswer('test-key',[],[],mock)).rejects.toThrow('The companion is unavailable');
 });
});
