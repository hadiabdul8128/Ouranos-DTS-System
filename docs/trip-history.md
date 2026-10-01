# Trip history

**Travel → Trip history and payments** (`/dashboard/travel/history`) lists every trip, newest first, with a Past / Current & upcoming / All switch and a year filter.

The top row of form boxes totals the selection: **Planned** (authorized budget from the latest plan), **Claimed** (expenses entered, in USD), **Paid to you** (payments the traveler recorded) and **Still owed** (claimed amounts on filed vouchers that are not marked paid).

Each trip is a travel claim slip: labeled form boxes for destination, dates, purpose, nights, planned, claimed and paid, a short plan and voucher status line, links to the plan and expenses, an itemized planned-versus-claimed table, and **Record payment**. A tilted ink stamp shows where payment stands: PAID with the date, AWAITING PAY (voucher in review, approved or verified), NOT FILED (past trip, no filed voucher) or UPCOMING.

## Payments

Ouranos is not connected to DTS or finance, so it cannot see reimbursements. Travelers record a payment themselves with **Record payment** (amount and date, prefilled with the claimed or planned total; saving stamps the slip PAID) and can edit or remove it. Recorded payments are saved in this browser for the signed-in account and workspace, alongside Upcoming items; they do not sync to other devices yet.

Expenses entered in another currency count toward Claimed once converted to USD; unconverted ones are noted on the trip rather than guessed.

The calculations live in `packages/domain/trip-history.ts` and are covered by `platform/tests/trip-history.test.ts`.
