# Authorization estimates

Before travel, meals and incidentals are an optional M&IE estimate. The traveler can include it in the authorization total or leave it out. Any free meals are expected arrangements, not statements about meals already received; unknown meals stay blank. Actual costs and changed arrangements are confirmed after travel.

The total is planned expenses plus the selected, supported M&IE estimate. The lodging limit is not added on top of entered hotel costs. A separate meals budget line prevents adding the estimate again. Unsupported rates (including the Government Meal Rate) are excluded and the existing rate guidance is shown.

Submission freezes the expense, M&IE and combined totals alongside the per-diem calculation in the immutable revision. The inbox confirmation retains that breakdown; reviewers and voucher approved-budget comparisons include M&IE consistently. Existing submissions retain their frozen per-diem evidence.

Travel’s Review inbox opens the shared Inbox. Reviewers can open Requests to review there to make approval decisions.

Demo approval records the exact submitted revision in its immutable audit, including when no S1 or command is assigned. The voucher loader accepts this explicit demo approval evidence. Earlier demo approvals are recovered only for the latest revision submitted before the matching audit, within the same organization, trip, authorization and submitting user. An approved status by itself does not authorize a voucher. Demo approval is available in every workspace by default and remains limited to the trip owner. An explicit DEMO_APPROVAL_ALL_WORKSPACES=false setting restores the workspace allowlist.

## Authorization layout

The expense editor and quick-add controls sit beside meals and the budget summary on desktop. On phones, meals and totals follow the expenses in a single column. Authorization controls and section headings use Nunito; the destination heading retains Fraunces and the existing dark olive palette.

The planned-expenses heading shows the expense count. The budget summary shows expense, selected meal and combined totals in one place. **Meal assumptions** expands the DFAC setting and provided-meal selections; its collapsed label reflects saved assumptions. Unsupported-rate warnings remain visible without opening it. No calculation, submission or approval rules change.

No database migration is required.
