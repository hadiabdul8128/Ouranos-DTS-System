# Upcoming

**Upcoming** is in the home screen header on every screen size, with a count of items due in the next 7 days. It opens a side panel with a month calendar and a list, soonest first, grouped into Overdue, This week, This month and Later. It shows appointments, deadlines, deployment dates and other reminders the user adds, plus the departure and return date of each current or upcoming trip, linked to its plan. Voucher status and deadlines are left out on purpose (`upcomingEntries(…, {vouchers:false})`).

Calendar days with items have a dot (red when overdue), and the remaining days of current and upcoming trips, from today on, are shaded as travel days. Choosing a day shows only that day's items, and **Add** starts with that date. Items can be marked done or removed.

Added items are saved in this browser for the signed-in account and workspace; they do not sync to other devices yet. Syncing them would need a new server record type and migration.

## Checklists (hidden)

The checklist page is removed from the interface for now. The checklist logic (`packages/domain/planner.ts`) and the `/v1/guide/checklist` and `/v1/guide/ask` endpoints remain, with tests, so the feature can return without rebuilding it.
