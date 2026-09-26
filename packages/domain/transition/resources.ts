/** Allowlisted public resources. Suggestions never contain model-generated URLs. */
export const transitionResources = {
 careers: {title:'My Next Move for Veterans',organization:'O*NET / U.S. Department of Labor',url:'https://www.mynextmove.org/vets/',purpose:'Explore civilian careers using your military experience and interests.'},
 jobCenter: {title:'Find an American Job Center',organization:'CareerOneStop / U.S. Department of Labor',url:'https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx',purpose:'Find local help with resumes, job searches, and training.'},
 apprenticeship: {title:'Explore registered apprenticeships',organization:'U.S. Department of Labor',url:'https://www.apprenticeship.gov/career-seekers',purpose:'Learn about paid work combined with structured training.'},
 counseling: {title:'VA career planning and guidance',organization:'U.S. Department of Veterans Affairs',url:'https://www.va.gov/careers-employment/education-and-career-counseling/',purpose:'Check eligibility for personalized education and career counseling.'},
 education: {title:'GI Bill Comparison Tool',organization:'U.S. Department of Veterans Affairs',url:'https://www.va.gov/education/gi-bill-comparison-tool/',purpose:'Compare schools and programs; confirm your own eligibility with VA.'},
 school: {title:'Choosing a GI Bill approved school',organization:'U.S. Department of Veterans Affairs',url:'https://www.va.gov/resources/choosing-a-gi-bill-approved-school/',purpose:'Review school quality, costs, and how to evaluate a program.'},
 housing: {title:'VA housing support',organization:'U.S. Department of Veterans Affairs',url:'https://www.va.gov/homeless/nationalcallcenter.asp',purpose:'Contact a counselor if you are homeless or at risk of losing housing.'},
} as const;
export type TransitionResourceId=keyof typeof transitionResources;
export const transitionResourcesCheckedOn='2026-09-25';
export const housingSupportPhone={label:'877-424-3838',href:'tel:8774243838'} as const;
export function transitionResource(id:string){return Object.hasOwn(transitionResources,id)?transitionResources[id as TransitionResourceId]:null}
