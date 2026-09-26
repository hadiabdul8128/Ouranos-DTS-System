import {transitionProfileSchema,transitionRecommendationSchema,type TransitionProfile,type TransitionRecommendation,type TransitionPathId,type TransitionSkillId} from '../../contracts/transition';
import {transitionResource,type TransitionResourceId} from './resources';

export const skillLabels:Record<TransitionSkillId,string>={leadership:'Leading a team',operations:'Organizing operations',technical:'Working with equipment or technology',people:'Helping or teaching people',analysis:'Solving problems with information'};
const action=(id:string,title:string,detail:string,resourceId:TransitionResourceId)=>({id,title,detail,resourceId});
/** Guided suggestions, not a benefit, hiring, or suitability determination. No external model calls. */
export function recommendTransition(input:TransitionProfile,generatedAt=new Date().toISOString()):TransitionRecommendation{
 const p=transitionProfileSchema.parse(input);
 const skillReason=p.skills.length?`You identified ${p.skills.map(s=>skillLabels[s].toLowerCase()).join(', ')} as strengths. Start by looking for work that uses those skills.`:'You can explore civilian roles without knowing a job title yet.';
 const context=p.interests?`Use your interest in “${p.interests}” to narrow your search; this is not a verified career match.`:'Try two different fields before committing to one.';
 const experience=p.militaryRole?`Search your role or military occupation code (“${p.militaryRole}”) in My Next Move. Confirm the results rather than assuming an equivalent civilian job.`:'Use My Next Move to explore interests or search your military occupation code.';
 const paths:TransitionRecommendation['paths']=[
  {id:'employment',title:'Find work using your experience',summary:'Translate what you already know into civilian work, with help from a local job counselor.',
   reasons:[p.goal==='job'?'Finding work is your stated priority.':p.incomeTiming==='now'?'You said income is urgent. A job search can run alongside training or school.':skillReason,skillReason],
   considerations:['Hiring timelines, pay, licenses, and openings depend on the employer and location. No job or income is guaranteed.',context],actions:[
    action('employment.explore','Choose two civilian roles to explore',`${experience} Save two roles you would be willing to learn more about.`,'careers'),
    action('employment.resume','Write three examples of work you did well',`${p.skills.length?`Use your strengths in ${p.skills.map(s=>skillLabels[s].toLowerCase()).join(', ')}. `:''}Describe what you did and the result in plain language. Bring these to a counselor for your resume.`,'jobCenter'),
    action('employment.connect','Find local job-search support',`Search for an American Job Center near ${p.location}. Ask about veteran employment support and the next appointment.`,'jobCenter'),
   ]},
  {id:'training',title:'Learn a skill while working',summary:'Explore registered apprenticeships and shorter training routes before paying for a course.',
   reasons:[p.goal==='training'?'You want to build skills for a new direction.':'Training can help you try a new field without first committing to a degree.',p.skills.includes('technical')?'You identified hands-on or technical experience. Compare it with the actual requirements of a training program.':context],
   considerations:['Registered apprenticeships combine paid work and training. Openings, pay, prerequisites, and start dates vary.',p.incomeTiming==='now'?'Before enrolling, confirm when paid work begins and whether you can cover any gap in income.':'Ask about total costs, credentials, and how the program supports finding work.'],actions:[
    action('training.explore','Explore two apprenticeship fields','Review registered apprenticeships and choose two fields that interest you. Look at the work itself and entry requirements.','apprenticeship'),
    action('training.compare','Check a local training option',`Ask a job counselor near ${p.location} about availability, paid start dates, prerequisites, and all costs. Do not pay based on a marketing promise.`,'jobCenter'),
    action('training.counsel','Check whether VA career guidance can help','Review the eligibility criteria and ask a counselor whether a training route fits your goals. Eligibility is determined by VA.','counseling'),
   ]},
  {id:'education',title:'Build toward a degree or credential',summary:'Compare programs and education support before deciding where to enroll.',
   reasons:[p.goal==='education'?'You said education is your preferred next step.':'Education may be useful if the work you want requires a degree or credential.',p.incomeTiming==='flexible'?'You have room to explore a longer route before needing income.':'Compare study time with your need for income; you can also explore work while studying.'],
   considerations:['GI Bill eligibility, remaining entitlement, and payments must be confirmed with VA. This plan does not establish eligibility.','Compare total costs, completion outcomes, transferable credits, and accreditation before enrolling.'],actions:[
    action('education.compare','Compare two programs','Use the GI Bill Comparison Tool to compare two programs related to your interests. Record tuition, location, and the credential earned.','education'),
    action('education.questions','Prepare questions for the school','Ask about military credit, accreditation, program completion, job outcomes, and your total cost after confirmed benefits.','school'),
    action('education.counsel','Discuss the choice with a counselor','Check eligibility for VA personalized career planning and guidance before committing to a program.','counseling'),
   ]},
 ];
 // Urgent income puts work first while preserving all alternatives. Branch and stage
 // never gate options or establish program eligibility.
 const preferred:TransitionPathId=p.incomeTiming==='now'||p.goal==='job'?'employment':p.goal==='education'?'education':p.goal==='training'?'training':'employment';
 paths.sort((a,b)=>Number(b.id===preferred)-Number(a.id===preferred));
 for(const path of paths)path.reasons=[...new Set(path.reasons)];
 return transitionRecommendationSchema.parse({version:'transition-v1',method:'guided_rules',generatedAt,paths});
}
export function validTransitionProgress(recommendation:TransitionRecommendation,selected:TransitionPathId|null,completed:string[]):boolean{
 if(!selected)return completed.length===0;
 const path=recommendation.paths.find(p=>p.id===selected);
 return Boolean(path)&&new Set(completed).size===completed.length&&completed.every(id=>path!.actions.some(a=>a.id===id&&transitionResource(a.resourceId)));
}
