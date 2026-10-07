const money=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);

/** Budget totals from the existing authorization calculation. */
export function AuthorizationSummary({expensesMinor,mealsMinor,mealsIncluded,totalMinor}:{expensesMinor:number;mealsMinor:number;mealsIncluded:boolean;totalMinor:number|null}){
 return <section className="authorization-summary" aria-labelledby="authorization-summary-title">
  <h3 id="authorization-summary-title">Budget summary</h3>
  <dl><div><dt>Planned expenses</dt><dd>{totalMinor===null?'Check amounts':money(expensesMinor)}</dd></div><div><dt>Meals & incidentals</dt><dd>{mealsIncluded?money(mealsMinor):'Excluded'}</dd></div><div className="authorization-summary-total"><dt>Authorization total <span>USD</span></dt><dd>{totalMinor===null?'Check amounts':money(totalMinor)}</dd></div></dl>
  <p>Estimated before travel. Confirm actual costs in your voucher.</p>
 </section>;
}
