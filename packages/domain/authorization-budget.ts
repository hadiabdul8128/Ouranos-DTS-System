import {computePerDiem} from '../../voucher/src/perDiem.js';
import type {PlanningModuleInput} from '../contracts/planning-module';
import type {Allowance} from './voucher-adapter';

/** M&IE is optional; lodging limits are never added on top of planned hotel costs. */
export function authorizationBudget(trip:{destination:string;departure:string;returnDate:string},form:Pick<PlanningModuleInput,'allowance'> & {approvedExpenseItems:Array<{category:string;authorizedAmountMinor:number}>},frozenAllowance?:Allowance|null){
 const expensesMinor=form.approvedExpenseItems.reduce((sum,item)=>sum+item.authorizedAmountMinor,0);
 const estimate=frozenAllowance===undefined?computePerDiem({startDate:trip.departure,endDate:trip.returnDate,destination:trip.destination,...form.allowance}):frozenAllowance;
 const mealsIncluded=Boolean(form.allowance?.enabled&&estimate?.supported&&!form.approvedExpenseItems.some(item=>item.category==='meals'));
 const mealsMinor=mealsIncluded?Math.round(estimate!.totals.mie*100):0;
 return {expensesMinor,mealsMinor,totalMinor:expensesMinor+mealsMinor,mealsIncluded};
}
