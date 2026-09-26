'use client';
import {useState,useRef,type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {transitionProfileSchema,transitionSkillIds,type TransitionProfile} from '@/packages/contracts/transition';
import {skillLabels} from '@/packages/domain/transition/recommend';
const empty:TransitionProfile={stage:'recently_separated',branch:'prefer_not_to_say',militaryRole:'',location:'',skills:[],interests:'',goal:'exploring',incomeTiming:'soon',housingSupport:false};
export function TransitionIntake({initial,onSave,onCancel,busy}:{initial?:TransitionProfile;onSave:(profile:TransitionProfile)=>void;onCancel?:()=>void;busy:boolean}){
 const [profile,setProfile]=useState(initial||empty),[step,setStep]=useState(0),[error,setError]=useState('');
 const heading=useRef<HTMLHeadingElement>(null);
 function change<K extends keyof TransitionProfile>(key:K,value:TransitionProfile[K]){setProfile(p=>({...p,[key]:value}));setError('')}
 function move(next:number){setStep(next);setError('');requestAnimationFrame(()=>heading.current?.focus())}
 function submit(e:FormEvent){e.preventDefault();const parsed=transitionProfileSchema.safeParse(profile);if(!parsed.success){setError(parsed.error.issues[0].message);return}if(step===0){move(1);return}onSave(parsed.data)}
 return <form onSubmit={submit} className="transition-intake">
  <p className="transition-eyebrow">{step+1} of 2 · {step===0?'About you':'Your next step'}</p>
  <h2 ref={heading} tabIndex={-1}>{step===0?'Start with where you are.':'What matters most right now?'}</h2>
  <fieldset disabled={busy}>
  {step===0?<>
   <label htmlFor="transition-stage">Where are you in your transition?</label><select id="transition-stage" value={profile.stage} onChange={e=>change('stage',e.target.value as TransitionProfile['stage'])}><option value="preparing">Preparing to leave the military</option><option value="recently_separated">Recently separated</option><option value="veteran">I have been out for a while</option></select>
   <label htmlFor="transition-location">Where do you want to live or work?</label><Input id="transition-location" required maxLength={120} placeholder="City, state, or area" autoComplete="address-level2" value={profile.location} onChange={e=>change('location',e.target.value)}/>
   <div className="transition-row"><div><label htmlFor="transition-branch">Service branch <span>(optional)</span></label><select id="transition-branch" value={profile.branch} onChange={e=>change('branch',e.target.value as TransitionProfile['branch'])}><option value="prefer_not_to_say">Prefer not to say</option><option value="army">Army</option><option value="navy">Navy</option><option value="air_force">Air Force</option><option value="marine_corps">Marine Corps</option><option value="space_force">Space Force</option><option value="coast_guard">Coast Guard</option><option value="other">Other</option></select></div>
   <div><label htmlFor="transition-role">Military role or code <span>(optional)</span></label><Input id="transition-role" value={profile.militaryRole} maxLength={160} placeholder="Job title, MOS, AFSC, or rating" onChange={e=>change('militaryRole',e.target.value)}/></div></div>
   <fieldset className="transition-skills"><legend>What are you good at? <span>(optional)</span></legend>{transitionSkillIds.map(skill=><label key={skill} className="transition-check"><input type="checkbox" checked={profile.skills.includes(skill)} onChange={e=>change('skills',e.target.checked?[...profile.skills,skill]:profile.skills.filter(s=>s!==skill))}/><span>{skillLabels[skill]}</span></label>)}</fieldset>
  </>:<>
   <fieldset className="transition-choices"><legend>Which direction interests you?</legend>{([['exploring','I’m figuring it out'],['job','Finding a job'],['training','Learning a new skill'],['education','School or a degree']] as const).map(([v,label])=><label className="transition-check" key={v}><input type="radio" name="goal" value={v} checked={profile.goal===v} onChange={()=>change('goal',v)}/><span>{label}</span></label>)}</fieldset>
   <fieldset className="transition-choices"><legend>How soon do you need income?</legend>{([['now','As soon as possible'],['soon','Within the next few months'],['flexible','I have time to explore']] as const).map(([v,label])=><label className="transition-check" key={v}><input type="radio" name="income" value={v} checked={profile.incomeTiming===v} onChange={()=>change('incomeTiming',v)}/><span>{label}</span></label>)}</fieldset>
   <label htmlFor="transition-interests">Anything you would like to try? <span>(optional)</span></label><textarea id="transition-interests" maxLength={500} rows={3} value={profile.interests} placeholder="For example, working with technology or starting a trade" onChange={e=>change('interests',e.target.value)}/>
   <label className="transition-check transition-housing-check"><input type="checkbox" checked={profile.housingSupport} onChange={e=>change('housingSupport',e.target.checked)}/><span>I would like help finding stable housing.</span></label>
  </>}
  </fieldset>
  {error&&<p role="alert" className="transition-error">{error}</p>}
  <div className="transition-controls"><Button type="submit" disabled={busy}>{busy?'Saving your plan…':step===0?'Continue':'See my options'}</Button>{step===1&&<button type="button" className="transition-text-button" disabled={busy} onClick={()=>move(0)}>Back</button>}{onCancel&&<button type="button" className="transition-text-button" disabled={busy} onClick={onCancel}>Cancel</button>}</div>
  {onCancel&&<p className="transition-fine">Saving answers starts a fresh action plan and resets completed steps.</p>}
  <p className="transition-fine">Your saved plan is private to your account in this workspace. Please leave out SSNs, medical records, and other sensitive documents.</p>
 </form>;
}
