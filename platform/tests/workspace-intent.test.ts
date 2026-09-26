import {describe,it,expect} from 'vitest';
import {workspaceIntent} from '../../packages/domain/workspace-intent';
describe('workspace entry routing',()=>{
 it.each(['Finish my voucher','plan a TDY trip','traveling','flight reimbursement'])('preserves travel request %s',text=>expect(workspaceIntent(text)).toBe('/dashboard/travel'));
 it.each(['What should I do after the military?','Find civilian work','I need a job','career planning','Transition'])('opens Transition for %s',text=>expect(workspaceIntent(text)).toBe('/dashboard/transition'));
 it.each(['','weather','Do not create a trip','no job search','cancel transition'])('does not navigate unrelated or negated request %s',text=>expect(workspaceIntent(text)).toBeNull());
});
