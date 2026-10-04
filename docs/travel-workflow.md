# Travel documents and unfinished drafts

Trip pages use a single four-stage timeline: Authorization, Approval, Voucher, Paid. Authorization and Approval open the authorization; Voucher and Paid open the voucher once authorization is approved. The duplicate Plan/Expenses tabs are removed. Travel dates still determine the next-step advice, but travel is no longer a document stage. A submitted voucher shows Waiting for payment even before the return date.

In voucher review, Add receipt opens the relevant expense and moves keyboard focus and the viewport to its receipt controls. Uploading or photographing receipts there selects them for that expense. Save expense commits the attachments; the receipt must still finish processing and be confirmed before voucher verification. The general receipt intake remains available for collecting documents separately.

Travel lists show Delete draft beside unfinished plans. Deleted drafts disappear from active trip lists, history, upcoming entries, and hotel context. Open Deleted drafts in Travel to restore a draft with its original data and attachments.

Deletion and restoration use online, versioned `trip.delete` and `trip.restore` commands. They synchronize pending trip records first, require the traveler’s ownership, and retain audit and sync events. Deletion changes the trip status to `cancelled`; restoration changes it back to `draft`. The server refuses trips with submission history, any non-draft authorization, or a voucher. Deleted drafts cannot be edited or submitted until restored. This does not permanently erase records or receipts.

Validation includes four-stage progress and early voucher filing, cancelled-trip history exclusion, traveler ownership, submission protection, stale versions, command replay, restoration, and blocked edits/submission while deleted. Local browser checks cover receipt upload and saved expense attachment, mobile receipt controls, the four-stage timeline, and draft/recovery controls. Temporary QA pages are removed before committing.

## Lost-receipt statements

A statement accepts a trimmed, non-empty reason up to 2,000 characters, including short reasons such as “Lost.” Empty or whitespace-only reasons keep Save statement disabled. The connected voucher, standalone voucher form, submission contract, and statement builder use the same limits.

Save statement persists the updated voucher draft immediately and reports whether it is synced or saved on the current device. A separate Save draft click is no longer necessary. Saving retains the statement’s expense version, date, vendor, amount, and traveler, and clears certification so the traveler must certify the updated voucher before verification. Submitted vouchers and stale expense or voucher versions remain protected.

Regression checks cover short and empty reasons, exact expense-version binding, local browser saving and reload, database persistence, verification, and the frozen statement export.
