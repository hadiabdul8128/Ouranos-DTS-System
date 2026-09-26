# Financial Readiness

Financial Readiness is a personal budgeting workflow at `/dashboard/financial-readiness`. It uses manually entered pay, costs, balances, and savings goals. It does not connect banks, move money, alter payroll/TSP, estimate benefits eligibility, or require an AI API key.

## Workflow

1. Enter take-home pay per paycheck, cadence, essential monthly costs, and everyday spending.
2. Set one savings goal, an optional deadline/separation month, and emergency savings targets.
3. Review monthly cash flow, savings pace, and a per-paycheck set-aside plan.
4. Optionally apply suggested saving amounts to the **plan**.
5. Report actual balances with **Update balances**. Reloading or applying suggestions never increases actual balances.

No sample financial profile is inserted into the product. Automated tests use isolated accounts and fixtures.

## Data and API

Contracts live in `packages/contracts/financial-readiness.ts`; arithmetic lives in `packages/domain/financial-readiness/calculate.ts`. Every dollar value is an integer number of USD cents, validated at runtime. The UI rejects malformed money strings rather than rounding them silently.

The existing authenticated platform SDK exposes:

```ts
await client.financialPlan(organizationId);
await client.saveFinancialPlan({
  organizationId,
  requestId: crypto.randomUUID(),
  expectedVersion: plan?.version ?? 0,
  profile,
  recordCheckIn: true,
});
```

Both calls use `/v1/financial-readiness/plan` (GET and PUT). GET returns `{ plan: null }` before setup. PUT returns the saved plan including server calculations. The generated OpenAPI document describes the complete schemas.

`FinancialProfile` contains `currency`, `takeHomePerPaycheckMinor`, `cadence`, optional informational `tspPerPaycheckMinor`, named monthly `expenses`, `monthlySpendingMinor`, `emergency` balances/targets/contribution, one named `goal` with kind/balance/target/contribution/deadline, `separationMonth`, and `surplusPriority`.

A new plan creates a balance check-in. Changed balances or a changed goal name require `recordCheckIn: true`. Applying saving targets uses `false`, preserving actual balances and history. Check-ins store the latest reported balance for each calendar month; the API returns the latest 24.

Updates use optimistic version checks. A conflict asks the user to reload. Ambiguous network/server failures preserve the exact request ID and payload for a safe retry; request ID reuse with different input is rejected.

## Calculation rules (`financial-readiness-v1`)

- Monthly/twice-monthly pay uses 1/2 paychecks. Weekly/biweekly pay uses conservative regular months of 4/2 paychecks; extra-paycheck months are excluded from commitments and projections. Annualized average income is displayed separately.
- Take-home pay is net pay. Payroll TSP is informational and is **not deducted again**.
- Available money = regular-month take-home minus essentials, spending, and chosen emergency/goal contributions.
- If commitments exceed income, show the shortfall and withhold savings forecasts. Do not assume unavailable money can be saved.
- Goal gap = maximum of target minus reported balance and zero. Monthly pace = gap divided by calendar months remaining, rounded up to the next cent. Additional saving = maximum of required pace minus chosen contribution and zero.
- A separation goal can use the separation month as its deadline when no explicit goal deadline exists. Other goal kinds require their own deadline for a pace calculation.
- Contributions are assumed to start next month. Current/past deadlines do not divide by zero; missing dates do not generate a forecast.
- Suggestions allocate only positive available money, in the user's chosen priority order. Remaining money stays available. Per-paycheck allocations use largest-remainder rounding so cents are accounted for.
- Forecast = reported balance plus a constant monthly contribution times months remaining. No growth, interest, employer match, taxes, extra paychecks, or GI Bill income are assumed.
- Actual progress changes only with reported balances. A rounded progress label cannot show 100% before the target is reached.

Set-aside targets are not a bill-payment calendar. Users must consider due dates and revisit plans when income, costs, or emergency targets change.

## Privacy and release

Migration: `supabase/migrations/20260926160000_financial_readiness.sql`.

Plans and check-ins are limited to their owner with active workspace membership, including at the database RLS layer. Other members and administrators cannot read another person's plan. Financial amounts are not copied to shared travel sync or audit metadata. Audit events record only plan version, rule version, and whether a check-in occurred.

The migration has been applied to the local development database only. Apply it through the normal reviewed migration/release process before deploying this feature; do not reset a shared database. Main and the hosted database are unchanged during feature review.

## Verification

Unit tests cover budget arithmetic, TSP double-count prevention, cadence, rounding, deadlines, forecasts, deficits, priorities, progress, and money parsing. Database/API integration tests cover save/reload, check-ins, optimistic conflicts, idempotency, strict validation, and isolation between owners/workspaces. Existing Travel/Voucher tests remain part of the regression suite.

Official educational links are maintained in `packages/domain/financial-readiness/resources.ts`: CFPB budgeting and emergency savings, DFAS military TSP, and VA education comparison tools. These links do not establish personalized investment advice or benefit eligibility.
