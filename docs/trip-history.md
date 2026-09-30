# Trip history

**Travel → Trip history and payments** (`/dashboard/travel/history`) lists every trip, newest first, with a Past / Current & upcoming / All switch and a year filter.

Totals for the selection: trips and nights, **Planned** (authorized budget from the latest plan), **Claimed** (expenses entered, in USD), **Paid** (payments the traveler recorded) and **Awaiting payment** (claimed amounts on filed vouchers that are not marked paid).

Each trip shows its dates, nights and purpose; planned, claimed and paid amounts; plan and voucher status; a category breakdown of planned versus claimed; links to the plan and expenses; and a payment status: Paid, Awaiting payment (voucher in review, approved or verified), Voucher not filed (past trip, no filed voucher) or Not due yet.

## Payments

Ouranos is not connected to DTS or finance, so it cannot see reimbursements. Travelers record a payment themselves with **Mark as paid** (amount and date, prefilled with the claimed or planned total) and can edit or remove it. Recorded payments are saved in this browser for the signed-in account and workspace, alongside Upcoming items; they do not sync to other devices yet.

Expenses entered in another currency count toward Claimed once converted to USD; unconverted ones are noted on the trip rather than guessed.

The calculations live in `packages/domain/trip-history.ts` and are covered by `platform/tests/trip-history.test.ts`.
