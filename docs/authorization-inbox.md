# Authorization confirmation in the Ouranos inbox

After a successful `authorization.submit` in required approval mode, the server creates one unread traveler notification in the same transaction as the submitted revision and review request. The existing reviewer notification and routing remain unchanged. An unsuccessful submission creates no confirmation, and replaying the same command creates no duplicates.

The notification contains a copy of the submitted trip and complete form, authorization/revision/request IDs, recipient and submission time. Opening it shows traveler, origin, destination, dates, purpose, timezone and every planned expense: category, description, USD budget, merchant, expected payment, expense/stay dates, nights and original currency/conversion details when supplied. The complete submitted record is expandable. The authorization link opens the current review status; the confirmation is a historical receipt of submission, not approval.

Inbox links and unread badges appear on Dashboard, Travel, planning and Voucher headers. `/dashboard/inbox` uses the existing recipient-scoped notification entities, offline cache, sync and `notification.read` command. Messages remain available after they are read. Read acknowledgments require a connection; failures are shown with a retry. Old notifications remain readable and link to travel or the existing reviewer inbox.

No new database migration, mail provider, API key or external email delivery is involved. Automated/preview approval modes and authorization review decisions are unchanged. Only future successful manual submissions get the new detailed confirmation; old messages are not rewritten or backfilled.

The meals/lodging estimate controls are removed from planning and Voucher screens. Existing saved expense amounts and allowance data remain intact, and new plans default to estimates disabled. The existing calculator and reconciliation rules are retained for compatibility.

Each level of the chain of command now also sends the traveler an update, and messages show a live chain-of-command tracker. See [chain of command](approval-chain.md).
