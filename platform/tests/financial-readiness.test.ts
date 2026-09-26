import {describe,it,expect} from 'vitest';
import {financialProfileSchema,financialSaveSchema,type FinancialProfile} from '../../packages/contracts/financial-readiness';
import {calculateFinancialReadiness} from '../../packages/domain/financial-readiness/calculate';
import {parseFinancialMoney} from '../../packages/domain/financial-readiness/money';
const profile:FinancialProfile={currency:'USD',takeHomePerPaycheckMinor:171000,cadence:'twice_monthly',tspPerPaycheckMinor:12000,expenses:[{id:crypto.randomUUID(),name:'Bills',monthlyAmountMinor:185000}],monthlySpendingMinor:30000,emergency:{targetMinor:300000,balanceMinor:300000,monthlyContributionMinor:0},goal:{kind:'separation',name:'Separation fund',targetMinor:2500000,balanceMinor:1140000,monthlyContributionMinor:45714,targetMonth:null},separationMonth:'2027-11',surplusPriority:'goal_first'};
const asOf='2026-09';
describe('Financial Readiness arithmetic',()=>{
 it('reproduces separation catch-up math in cents without double-counting TSP',()=>{
  const r=calculateFinancialReadiness(profile,asOf);expect(r.monthlyTakeHomeMinor).toBe(342000);expect(r.monthlyTspMinor).toBe(24000);expect(r.monthlyUnassignedMinor).toBe(81286);
  expect(r.monthsToGoal).toBe(14);expect(r.baselineForecastMinor).toBe(1779996);expect(r.requiredMonthlyGoalMinor).toBe(97143);expect(r.additionalMonthlyGoalMinor).toBe(51429);expect(r.goalTopUpMinor).toBe(51429);expect(r.suggestedForecastMinor).toBe(2500002);expect(r.goalStatus).toBe('behind');
 });
 it('does not change available take-home money when payroll TSP changes',()=>{
  const a=calculateFinancialReadiness(profile,asOf),b=calculateFinancialReadiness({...profile,tspPerPaycheckMinor:99999},asOf);expect(b.monthlyUnassignedMinor).toBe(a.monthlyUnassignedMinor);expect(b.allocations).toEqual(a.allocations);
 });
 it('respects the chosen order for allocating extra cash',()=>{
  const p={...profile,emergency:{...profile.emergency,balanceMinor:0}};
  const emergency=calculateFinancialReadiness({...p,surplusPriority:'emergency_first'},asOf);expect(emergency.emergencyTopUpMinor).toBe(81286);expect(emergency.goalTopUpMinor).toBe(0);
  const goal=calculateFinancialReadiness(p,asOf);expect(goal.goalTopUpMinor).toBe(51429);expect(goal.emergencyTopUpMinor).toBe(29857);
  const keep=calculateFinancialReadiness({...p,surplusPriority:'keep_available'},asOf);expect(keep.goalTopUpMinor+keep.emergencyTopUpMinor).toBe(0);expect(keep.allocations.find(a=>a.id==='buffer')!.monthlyMinor).toBe(81286);
 });
 it('cannot assign more additional saving than the available budget',()=>{
  const r=calculateFinancialReadiness({...profile,takeHomePerPaycheckMinor:135000},asOf);expect(r.monthlyUnassignedMinor).toBe(9286);expect(r.goalTopUpMinor).toBe(9286);expect(r.suggestedForecastMinor).toBeLessThan(profile.goal.targetMinor);
 });
 it('flags unaffordable budgets and suppresses unsupported forecasts',()=>{
  const r=calculateFinancialReadiness({...profile,takeHomePerPaycheckMinor:100000},asOf);expect(r.monthlyDeficitMinor).toBe(60714);expect(r.goalStatus).toBe('budget_shortfall');expect(r.baselineForecastMinor).toBeNull();expect(r.suggestedForecastMinor).toBeNull();expect(r.goalTopUpMinor+r.emergencyTopUpMinor).toBe(0);expect(r.perPaycheckDeficitMinor).toBe(30357);
 });
 it('handles no income without suggesting an automatic transfer',()=>{const r=calculateFinancialReadiness({...profile,takeHomePerPaycheckMinor:0},asOf);expect(r.monthlyDeficitMinor).toBeGreaterThan(0);expect(r.goalTopUpMinor).toBe(0)});
 it.each(['biweekly','weekly'] as const)('uses a conservative ordinary month for %s pay',cadence=>{
  const r=calculateFinancialReadiness({...profile,cadence},asOf);expect(r.monthlyTakeHomeMinor).toBe(profile.takeHomePerPaycheckMinor*(cadence==='biweekly'?2:4));expect(r.averageMonthlyTakeHomeMinor).toBeGreaterThan(r.monthlyTakeHomeMinor);expect(r.allocations.reduce((s,a)=>s+a.perPaycheckMinor,0)).toBe(profile.takeHomePerPaycheckMinor);
 });
 it('keeps every cent accounted for even when reserve splits need rounding',()=>{
  for(let amount=1;amount<100;amount++){const p={...profile,takeHomePerPaycheckMinor:amount,cadence:'weekly' as const,expenses:[],monthlySpendingMinor:1,emergency:{balanceMinor:0,targetMinor:0,monthlyContributionMinor:1},goal:{...profile.goal,monthlyContributionMinor:1},surplusPriority:'keep_available' as const};const r=calculateFinancialReadiness(p,asOf);expect(r.allocations.reduce((s,a)=>s+a.perPaycheckMinor,0)).toBe(amount);expect(r.allocations.reduce((s,a)=>s+a.monthlyMinor,0)).toBe(amount*4)}
 });
 it('handles deadlines this month and overdue goals without division by zero',()=>{
  for(const [targetMonth,status] of [['2026-09','due_now'],['2026-08','overdue']] as const){const r=calculateFinancialReadiness({...profile,goal:{...profile.goal,targetMonth}},asOf);expect(r.goalStatus).toBe(status);expect(r.monthsToGoal).toBe(0);expect(r.requiredMonthlyGoalMinor).toBeNull()}
 });
 it('handles no deadline and already-reached goals',()=>{
  const r=calculateFinancialReadiness({...profile,separationMonth:null},asOf);expect(r.goalStatus).toBe('no_deadline');expect(r.baselineForecastMinor).toBeNull();
  const reached=calculateFinancialReadiness({...profile,goal:{...profile.goal,balanceMinor:3000000}},asOf);expect(reached.goalStatus).toBe('reached');expect(reached.goalProgressPercent).toBe(100);expect(reached.goalGapMinor).toBe(0);expect(reached.goalTopUpMinor).toBe(0);
 });
 it('does not round incomplete goals to 100% and safely handles a deficit without a deadline',()=>{
  const almost=calculateFinancialReadiness({...profile,goal:{...profile.goal,balanceMinor:profile.goal.targetMinor-1}},asOf);expect(almost.goalProgressPercent).toBe(99.9);expect(almost.goalStatus).not.toBe('reached');
  const noDate=calculateFinancialReadiness({...profile,separationMonth:null,takeHomePerPaycheckMinor:0},asOf);expect(noDate.monthsToGoal).toBeNull();expect(noDate.baselineForecastMinor).toBeNull();expect(noDate.goalStatus).toBe('budget_shortfall');
 });
 it('moves projections closer to separation without inventing balance growth',()=>{const a=calculateFinancialReadiness(profile,'2026-09'),b=calculateFinancialReadiness(profile,'2026-10');expect(b.monthsToSeparation).toBe(13);expect(b.goalProgressPercent).toBe(a.goalProgressPercent);expect(b.additionalMonthlyGoalMinor).toBeGreaterThan(a.additionalMonthlyGoalMinor!)});
 it('measures real reported progress independently from projected saving',()=>expect(calculateFinancialReadiness({...profile,goal:{...profile.goal,targetMinor:1500000,balanceMinor:930000}},asOf).goalProgressPercent).toBe(62));
 it('rejects negative amounts, fractions of cents, malformed dates, and client forecasts',()=>{
  expect(financialProfileSchema.safeParse({...profile,takeHomePerPaycheckMinor:-1}).success).toBe(false);expect(financialProfileSchema.safeParse({...profile,takeHomePerPaycheckMinor:1.5}).success).toBe(false);expect(financialProfileSchema.safeParse({...profile,separationMonth:'2026-13'}).success).toBe(false);
  expect(financialSaveSchema.safeParse({organizationId:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedVersion:0,profile,calculation:{}}).success).toBe(false);
 });
 it.each([['1,300.00',130000],['$1,430.99',143099],['0',0],['0.1',10],['12.345',null],['1,30',null],['-1',null],['1e3',null],['',null],['NaN',null]] as const)('parses %s strictly', (value,expected)=>expect(parseFinancialMoney(value)).toBe(expected));
});
