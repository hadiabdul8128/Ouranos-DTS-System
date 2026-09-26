import {describe,it,expect} from 'vitest';
import {transitionProfileSchema,transitionSaveSchema,type TransitionProfile} from '../../packages/contracts/transition';
import {recommendTransition,validTransitionProgress} from '../../packages/domain/transition/recommend';
import {transitionResources,transitionResource} from '../../packages/domain/transition/resources';
const profile:TransitionProfile={stage:'recently_separated',branch:'army',militaryRole:'Logistics specialist',location:'Raleigh, NC',skills:['operations','leadership'],interests:'Supply chain',goal:'exploring',incomeTiming:'soon',housingSupport:false};
const time='2026-09-25T12:00:00.000Z';
describe('Transition guided recommendations',()=>{
 it('offers three concrete paths and exactly three sourced actions each',()=>{
  const r=recommendTransition(profile,time);expect(r.method).toBe('guided_rules');expect(r.version).toBe('transition-v1');expect(r.generatedAt).toBe(time);
  expect(new Set(r.paths.map(p=>p.id)).size).toBe(3);
  for(const path of r.paths){expect(path.actions).toHaveLength(3);expect(path.reasons.length).toBeGreaterThan(0);for(const a of path.actions)expect(transitionResource(a.resourceId)).not.toBeNull()}
  expect(r.paths[0].actions[2].detail).toContain('Raleigh, NC');expect(r.paths[0].actions[0].detail).toContain('Logistics specialist');
 });
 it.each(['education','training'] as const)('honors %s goals when income is flexible',goal=>expect(recommendTransition({...profile,goal,incomeTiming:'flexible'},time).paths[0].id).toBe(goal));
 it('puts urgent income first without hiding education or training',()=>{
  const r=recommendTransition({...profile,goal:'education',incomeTiming:'now'},time);expect(r.paths[0].id).toBe('employment');expect(r.paths.map(p=>p.id)).toContain('education');expect(r.paths.find(p=>p.id==='training')!.considerations.join(' ')).toContain('gap in income');
 });
 it('does not stereotype by service branch or infer eligibility from separation stage',()=>expect(recommendTransition({...profile,branch:'navy',stage:'preparing'},time)).toEqual(recommendTransition(profile,time)));
 it('handles exploring with no known occupation or skills',()=>{
  const r=recommendTransition({...profile,militaryRole:'',skills:[],interests:''},time);expect(r.paths).toHaveLength(3);expect(r.paths[0].actions[0].detail).toMatch(/explore interests/);
 });
 it('rejects forged, unselected, and duplicate completion IDs',()=>{
  const r=recommendTransition(profile,time);expect(validTransitionProgress(r,null,[])).toBe(true);
  expect(validTransitionProgress(r,null,['employment.explore'])).toBe(false);expect(validTransitionProgress(r,'education',['employment.explore'])).toBe(false);
  expect(validTransitionProgress(r,'employment',['employment.explore','employment.explore'])).toBe(false);expect(validTransitionProgress(r,'employment',['made-up'])).toBe(false);
  expect(validTransitionProgress(r,'employment',r.paths[0].actions.map(a=>a.id))).toBe(true);
 });
 it('validates personal input and does not accept client-written recommendations',()=>{
  expect(transitionProfileSchema.safeParse({...profile,location:' '}).success).toBe(false);expect(transitionProfileSchema.safeParse({...profile,skills:['technical','technical']}).success).toBe(false);
  const save={organizationId:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedVersion:0,profile,selectedPath:null,completedActionIds:[]};
  expect(transitionSaveSchema.safeParse(save).success).toBe(true);expect(transitionSaveSchema.safeParse({...save,recommendation:{}}).success).toBe(false);
 });
 it('only exposes allowlisted official resource URLs and handles unknown IDs safely',()=>{
  for(const r of Object.values(transitionResources)){const u=new URL(r.url);expect(u.protocol).toBe('https:');expect(['www.va.gov','www.apprenticeship.gov','www.mynextmove.org','www.careeronestop.org']).toContain(u.hostname)}
  expect(transitionResource('__proto__')).toBeNull();expect(transitionResource('unknown')).toBeNull();
 });
});
