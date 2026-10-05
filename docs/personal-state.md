# Private workspace state

Lightweight user-specific state is stored in `ouranos.personal_state`, keyed by organization, Auth user and one of three bounded keys:

- `planner`: appointments, deadlines and reminders from Upcoming;
- `preferences`: traveler defaults, the usual payment method and larger-text setting;
- `voucher_documents`: per-trip document checklist ticks.

The API verifies the Supabase bearer token, enters the restricted `ouranos_api` role and requires an active membership in the selected organization. Row-level security additionally restricts every row to `auth.uid()`. Other workspace members, including administrators, cannot read another user’s personal state. Values are JSON objects capped at 256 KB. Travel records, approvals, payments, team checklists and receipt files continue to use their dedicated tables and storage bucket.

The client keeps a small scoped browser cache for offline startup. Existing planner items and voucher-document ticks from browser-only releases are uploaded on first use. Supabase is authoritative once connected.
