import {financialProfileSchema,financialMonthSchema,financialCalculationSchema,type FinancialProfile,type FinancialCalculation} from '../../contracts/financial-readiness';
export const paychecksPerYear={monthly:12,twice_monthly:24,biweekly:26,weekly:52} as const;
export const regularPaychecksPerMonth={monthly:1,twice_monthly:2,biweekly:2,weekly:4} as const;
export const payCadenceLabels={monthly:'Once a month',twice_monthly:'Twice a month',biweekly:'Every two weeks',weekly:'Every week'} as const;
const monthNumber=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
const monthsUntil=(asOf:string,target:string|null)=>target?Math.max(0,monthNumber(target)-monthNumber(asOf)):null;
/** Largest remainder rounding keeps cent allocations equal to the paycheck total. */
function perPaycheck(monthly:number[],regular:number){
 const raw=monthly.map(v=>v/regular),result=raw.map(Math.floor);
 const remainder=Math.round(raw.reduce((a,b)=>a+b,0))-result.reduce((a,b)=>a+b,0);
 const order=raw.map((v,i)=>({i,fraction:v-result[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(let i=0;i<remainder;i++)result[order[i].i]++;
 return result;
}
/** Planning arithmetic only. No returns, match, benefits, tax estimates, or transfers. */
export function calculateFinancialReadiness(input:FinancialProfile,asOfMonth=new Date().toISOString().slice(0,7)):FinancialCalculation{
 const p=financialProfileSchema.parse(input);financialMonthSchema.parse(asOfMonth);
 const annualPaychecks=paychecksPerYear[p.cadence];
 const regular=regularPaychecksPerMonth[p.cadence];
 // Conservative ordinary months. Extra weekly/biweekly checks are excluded from
 // commitments and forecasts so a two-check month can cover its own budget.
 const monthlyTakeHomeMinor=p.takeHomePerPaycheckMinor*regular;
 const averageMonthlyTakeHomeMinor=Math.round(p.takeHomePerPaycheckMinor*annualPaychecks/12);
 const monthlyTspMinor=p.tspPerPaycheckMinor*regular;
 const monthlyEssentialsMinor=p.expenses.reduce((sum,e)=>sum+e.monthlyAmountMinor,0);
 // Payroll TSP is already withheld from entered net pay, so is not subtracted here.
 const monthlyCommittedMinor=monthlyEssentialsMinor+p.monthlySpendingMinor+p.emergency.monthlyContributionMinor+p.goal.monthlyContributionMinor;
 const monthlyUnassignedMinor=monthlyTakeHomeMinor-monthlyCommittedMinor,monthlyDeficitMinor=Math.max(0,-monthlyUnassignedMinor);
 const effectiveGoalMonth=p.goal.targetMonth||(p.goal.kind==='separation'?p.separationMonth:null);
 const monthsToGoal=monthsUntil(asOfMonth,effectiveGoalMonth),monthsToSeparation=monthsUntil(asOfMonth,p.separationMonth);
 const goalGapMinor=Math.max(0,p.goal.targetMinor-p.goal.balanceMinor);
 const requiredMonthlyGoalMinor=monthsToGoal&&monthsToGoal>0?Math.ceil(goalGapMinor/monthsToGoal):null;
 const additionalMonthlyGoalMinor=requiredMonthlyGoalMinor===null?null:Math.max(0,requiredMonthlyGoalMinor-p.goal.monthlyContributionMinor);
 // Cover the user's chosen emergency target first, then the goal's required pace.
 const emergencyNeed=Math.max(0,p.emergency.targetMinor-p.emergency.balanceMinor-p.emergency.monthlyContributionMinor);
 const goalNeed=goalGapMinor===0?0:additionalMonthlyGoalMinor===null?Math.max(0,goalGapMinor-p.goal.monthlyContributionMinor):additionalMonthlyGoalMinor;
 let remaining=Math.max(0,monthlyUnassignedMinor),emergencyTopUpMinor=0,goalTopUpMinor=0;
 if(p.surplusPriority!=='keep_available'){
  for(const destination of p.surplusPriority==='emergency_first'?['emergency','goal']:['goal','emergency']){
   const amount=Math.min(remaining,destination==='emergency'?emergencyNeed:goalNeed);remaining-=amount;
   if(destination==='emergency')emergencyTopUpMinor=amount;else goalTopUpMinor=amount;
  }
 }
 const baselineForecastMinor=monthsToGoal===null||monthlyDeficitMinor>0?null:p.goal.balanceMinor+p.goal.monthlyContributionMinor*monthsToGoal;
 // Top-ups are a suggestion for this month's budget. Forecast assumes the user
 // can maintain this rate each future month, explicitly explained in the UI.
 const suggestedForecastMinor=monthsToGoal===null||monthlyDeficitMinor>0?null:p.goal.balanceMinor+(p.goal.monthlyContributionMinor+goalTopUpMinor)*monthsToGoal;
 const goalStatus:FinancialCalculation['goalStatus']=goalGapMinor===0?'reached':effectiveGoalMonth&&monthNumber(effectiveGoalMonth)<monthNumber(asOfMonth)?'overdue':monthsToGoal===0?'due_now':monthlyDeficitMinor>0?'budget_shortfall':monthsToGoal===null?'no_deadline':baselineForecastMinor!>=p.goal.targetMinor?'on_track':'behind';
 const allocations:FinancialCalculation['allocations']=[
  {id:'essentials',label:'Bills and essential costs',monthlyMinor:monthlyEssentialsMinor,perPaycheckMinor:0},
  {id:'spending',label:'Everyday spending',monthlyMinor:p.monthlySpendingMinor,perPaycheckMinor:0},
  {id:'emergency',label:'Emergency fund',monthlyMinor:p.emergency.monthlyContributionMinor+emergencyTopUpMinor,perPaycheckMinor:0},
  {id:'goal',label:p.goal.name,monthlyMinor:p.goal.monthlyContributionMinor+goalTopUpMinor,perPaycheckMinor:0},
  {id:'buffer',label:'Keep available',monthlyMinor:Math.max(0,monthlyUnassignedMinor-emergencyTopUpMinor-goalTopUpMinor),perPaycheckMinor:0},
 ];
 const paycheckParts=perPaycheck(allocations.map(a=>a.monthlyMinor),regular);
 allocations.forEach((a,i)=>a.perPaycheckMinor=paycheckParts[i]);
 const perPaycheckRequiredMinor=paycheckParts.reduce((a,b)=>a+b,0);
 return financialCalculationSchema.parse({ruleVersion:'financial-readiness-v1',asOfMonth,annualPaychecks,regularPaychecksPerMonth:regular,averageMonthlyTakeHomeMinor,monthlyTakeHomeMinor,monthlyTspMinor,monthlyEssentialsMinor,monthlyCommittedMinor,monthlyUnassignedMinor,monthlyDeficitMinor,emergencyTopUpMinor,goalTopUpMinor,effectiveGoalMonth,monthsToGoal,monthsToSeparation,goalProgressPercent:Math.min(100,Math.round(p.goal.balanceMinor/p.goal.targetMinor*100)),goalGapMinor,requiredMonthlyGoalMinor,additionalMonthlyGoalMinor,baselineForecastMinor,suggestedForecastMinor,goalStatus,allocations,perPaycheckRequiredMinor,perPaycheckDeficitMinor:Math.max(0,perPaycheckRequiredMinor-p.takeHomePerPaycheckMinor)});
}
