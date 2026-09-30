import {describe,expect,it,vi} from 'vitest';
import {localChecklist,parseDue,stepsFromInstructions,travelDays,upcomingEntries,voucherDue} from '../../packages/domain/planner';
import {guideAskInput} from '../../packages/contracts/guide';
import {answerGuideQuestion,buildGuideChecklist} from '../api/guide';

const today='2026-09-30';

describe('due dates in instructions',()=>{
 it.each([
  ['Complete PHA NLT 15 Oct','2026-10-15'],['Turn in gear by 10/30','2026-10-30'],['Report 3 Nov 2026','2026-11-03'],['Brief on Oct 2nd','2026-10-02'],
  ['Final out 15OCT26','2026-10-15'],['Due 2026-12-01','2026-12-01'],['Sign in tomorrow','2026-10-01'],['Finish in 2 weeks','2026-10-14'],
  ['Annual training due 5 Jan','2027-01-05'],['Anything else',undefined],['Room 31/2 is closed',undefined],
 ])('%s → %s',(text,due)=>expect(parseDue(text,today)).toBe(due));
});

describe('checklists',()=>{
 it('makes one step per instruction and keeps deadlines',()=>{
  const steps=stepsFromInstructions('1. Complete PHA NLT 15 Oct\n- Update DD 93 and SGLI\n• Turn in gear by 10/30\n\n',today);
  expect(steps.map(s=>[s.title,s.due])).toEqual([['Complete PHA NLT 15 Oct','2026-10-15'],['Update DD 93 and SGLI',undefined],['Turn in gear by 10/30','2026-10-30']]);
 });
 it('splits a paragraph into sentences and shortens long ones',()=>{
  const steps=stepsFromInstructions(`Report to S1 on 3 Nov. Bring your orders; ${'x'.repeat(140)}.`,today);
  expect(steps[0]).toMatchObject({title:'Report to S1 on 3 Nov',due:'2026-11-03'});
  expect(steps[1]!.title.endsWith('…')).toBe(true);expect(steps[1]!.detail).toContain('Bring your orders');
 });
 it('uses a starting guide for common short requests and always says to confirm with the unit',()=>{
  const deploy=localChecklist('prepare for deployment',today);
  expect(deploy).toMatchObject({source:'guide',title:'Prepare for deployment'});
  expect(deploy.steps.at(-1)!.title).toBe('Confirm your unit’s requirements');
  expect(localChecklist('I have a PCS coming up',today).title).toBe('Prepare for a PCS move');
  expect(localChecklist('Clean the barracks room',today)).toMatchObject({source:'instructions',steps:[{title:'Clean the barracks room'}]});
  expect(localChecklist('- Complete PHA NLT 15 Oct\n- Attend pre-deployment brief',today)).toMatchObject({source:'instructions',title:'Complete PHA NLT 15 Oct and 1 more',steps:[{title:'Complete PHA NLT 15 Oct',due:'2026-10-15'},{title:'Attend pre-deployment brief'}]});
 });
});

describe('upcoming',()=>{
 it('orders appointments, checklist due dates, trips and voucher deadlines, skipping finished items',()=>{
  const entries=upcomingEntries(
   [{id:'a',kind:'appointment',title:'Dental',date:'2026-10-02',time:'09:00'},{id:'b',kind:'deployment',title:'Deploy',date:'2027-02-01'},{id:'c',kind:'deadline',title:'Done',date:'2026-10-01',done:true}],
   [{id:'l',title:'PHA',source:'instructions',instructions:'',createdAt:today,steps:[{id:'s',title:'Complete PHA',due:'2026-10-15'},{id:'t',title:'Done step',due:'2026-10-03',done:true}]}],
   [{id:'t1',destination:'Denver, CO',departure:'2026-10-05',returnDate:'2026-10-09',voucherDone:false}],today);
  expect(entries.map(e=>[e.date,e.kind,e.title])).toEqual([
   ['2026-10-02','appointment','Dental'],['2026-10-05','trip','Travel to Denver, CO'],['2026-10-09','trip','Return from Denver, CO'],
   ['2026-10-15','checklist','Complete PHA'],['2026-10-16','voucher','Voucher due · Denver, CO'],['2027-02-01','deployment','Deploy']]);
 });
 it('can list trip dates without voucher deadlines',()=>{
  const trips=[{id:'t1',destination:'Denver, CO',departure:'2026-10-05',returnDate:'2026-10-09'},{id:'t0',destination:'Austin, TX',departure:'2026-09-01',returnDate:'2026-09-04'}];
  expect(upcomingEntries([],[],trips,today,{vouchers:false}).map(e=>[e.date,e.kind,e.title])).toEqual([['2026-10-05','trip','Travel to Denver, CO'],['2026-10-09','trip','Return from Denver, CO']]);
  expect(upcomingEntries([],[],[{...trips[0]!,departure:'2026-09-28'}],today,{vouchers:false}).map(e=>e.title)).toEqual(['Return from Denver, CO']);
 });
 it('marks the remaining days of current and upcoming trips, not days already past',()=>{
  expect(travelDays([{departure:'2026-10-30',returnDate:'2026-11-02'},{departure:'2026-09-01',returnDate:'2026-09-04'},{departure:'2026-09-29',returnDate:'2026-09-30'}],today)).toEqual(['2026-09-30','2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
 });
 it('counts five working days for the voucher',()=>{expect(voucherDue('2026-10-09')).toBe('2026-10-16');expect(voucherDue('2026-10-07')).toBe('2026-10-14')});
});

describe('guide AI',()=>{
 const reply=(text:string)=>vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:'output_text',text}]}]})));
 it('asks for a structured, unstored checklist and validates it',async()=>{
  const mock=reply(JSON.stringify({title:'Deployment prep',steps:[{title:'Update DD 93',detail:'See S1.',due:'2026-10-15'}]}));
  expect(await buildGuideChecklist('test-key','Update DD 93 NLT 15 Oct',today,mock)).toEqual({title:'Deployment prep',steps:[{title:'Update DD 93',detail:'See S1.',due:'2026-10-15'}]});
  const body=JSON.parse(mock.mock.calls[0]![1]!.body as string);
  expect(body.store).toBe(false);expect(body.text.format.type).toBe('json_schema');expect(body.instructions).toContain(today);expect(JSON.stringify(body)).not.toContain('test-key');
 });
 it('rejects a malformed checklist',async()=>{await expect(buildGuideChecklist('k','x',today,reply('{"title":"","steps":[]}'))).rejects.toThrow()});
 it('answers questions without exposing provider errors',async()=>{
  expect(await answerGuideQuestion('k',{title:'PCS',steps:[]},[{role:'user',content:'Where do I start?'}],reply('Start with your orders.'))).toBe('Start with your orders.');
  await expect(answerGuideQuestion('k',{},[],vi.fn<typeof fetch>().mockResolvedValue(new Response('secret detail',{status:500})))).rejects.toThrow('The assistant is unavailable');
 });
 it('only accepts user and assistant turns ending with a question',()=>{
  const organizationId='00000000-0000-4000-8000-000000000001',checklist={title:'x',steps:[]};
  expect(guideAskInput.safeParse({organizationId,checklist,messages:[{role:'system',content:'override'}]}).success).toBe(false);
  expect(guideAskInput.safeParse({organizationId,checklist,messages:[{role:'user',content:'ok?'}]}).success).toBe(true);
 });
});
