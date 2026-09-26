# Voucher automatic verification

Authorization can use either the existing human approval workflow or internal automatic verification when `APPROVAL_MODE=automatic`. A traveler can verify a Voucher only against an Authorization with an immutable accepted revision. The `voucher.submit` command is the server entry point; a browser flag cannot mark a Voucher verified.

## State and traveler flow

| From | Action | To |
| --- | --- | --- |
| `draft` or `needs_action` | Traveler certifies and runs verification | `verified` or `needs_action` |
| `needs_action` | Traveler edits and saves the Voucher | `draft` |
| `verified` | No further edits on this revision | Locked |

The interface shows **Verifying…** while the command is in flight. The server writes one immutable submission revision and one immutable verification report per successful verification attempt. Verification that finds blockers returns `needs_action` with specific issues; the traveler may correct the saved expenses, documents, or explanations and run it again. A clean Voucher creates no human approval request or approval steps. Older Voucher approvals remain readable for existing records.

## Server decision

The server requires a current Voucher form with traveler certification, complete expense intake, consistent arithmetic and references, trip ownership, an approved Authorization, and a frozen approved Authorization revision. It reloads each expense and linked document, checks for another submitted Voucher claiming the same expense, and reruns `reconcileStoredExpenses` against the frozen plan. Existing reconciliation rules cover dates, duplicates, authorization matching, receipt requirements, lodging/per-diem, payment method, and valid traveler resolutions. A linked document must be processed and confirmed. If a high-confidence OCR paid total differs from the saved expense amount, verification requires correction. Lower-confidence or missing OCR totals are recorded as warnings when the traveler has confirmed the original receipt.

`voucherModuleSchema` remains the strict verified-submission schema: certification, intake, no unresolved issue IDs, and consistent totals. The verification candidate schema accepts unresolved issue IDs solely to return an auditable `needs_action` report instead of rejecting the attempt before explaining it. Neither schema accepts a client `verified` property. The server recomputes the final result.

## Audit and API

`ouranos.voucher_verifications` stores the result, rule version, timestamp, frozen submission SHA-256, counts, totals, evidence IDs and OCR totals used, checks, warnings, blockers, and reconciliation output. Its update/delete trigger makes each report append-only. The frozen `submission_revisions` row holds the Voucher, trip, approved Authorization revision, expense and document records, reconciliation, and statements.

The authenticated `GET /v1/vouchers/:id/verification?organizationId=…` returns the latest report and associated revision for a traveler or another user already allowed to view that trip. The Voucher page shows the result and links to `/dashboard/travel/vouchers/verification?tripId=…&voucherId=…` for full details. A verified Voucher can download the frozen DTS preparation package, which includes the report. `needs_action` cannot download a submitted package; a preview draft package still follows existing preview-mode rules.

The SHA-256 identifies the frozen submission, not the report row. The report separately stores the OCR values and confidence used for its checks. Reports for prior attempts remain after the traveler edits a `needs_action` Voucher.

## Boundaries and deployment

“Verified by Ouranos” means these application checks passed. It does not mean government or DTS approval, entitlement, reimbursement authorization, payment, or submission to DTS. `integration.request` still expects an approved human request; a verified Voucher does not satisfy that older integration path. A future authorized DTS integration should consume the verified frozen revision through a separate delivery contract.

Apply `supabase/migrations/20260926012804_voucher_auto_verification.sql` before deploying the API and client. Continue to configure the existing Supabase Auth, Postgres, storage, and receipt worker per the platform deployment instructions. The new verifier has no AI provider secret or external DTS dependency. Existing `in_review`/`approved` Voucher rows and approval history remain for backward compatibility.
