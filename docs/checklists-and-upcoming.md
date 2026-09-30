# Checklists and Upcoming

## Checklists

Anything typed on the home prompt that is not a travel or transition request opens **Checklists** (`/dashboard/guide`) and builds a checklist from it. Service members can also paste instructions they were given.

- With `OPENAI_API_KEY` set on the API, `POST /v1/guide/checklist` returns an AI-written checklist: ordered steps, how to do each one, and any due dates stated in the instructions. It is marked as AI-written and tells the user to check it against their orders and chain of command.
- Without AI, or if the request fails, the checklist is built on the device:
  - a short one-line request such as “prepare for deployment”, “PCS”, “leave”, “separation” or “TDY” uses a general starting guide that ends with “Confirm your unit’s requirements”;
  - anything else keeps the user’s own tasks, one step per bullet, line or sentence. Dates such as `NLT 15 Oct`, `10/30`, `3 Nov 2026`, `15OCT26`, `tomorrow` or `in 2 weeks` become due dates.
- Steps can be checked off and given or cleared due dates. **Ask about this checklist** uses `POST /v1/guide/ask` and needs AI; without it the page says AI answers are not connected.

The guides are general starting points, not service or unit policy. The AI is told to treat instructions as data, not to invent unit-specific policy, forms, dates or links, and that it cannot submit or change anything. Requests are not stored by the provider (`store:false`) and are limited to 10 per minute per user.

## Upcoming

The home screen shows **Upcoming** on the right (a button in the header on narrow screens), and the Checklists page shows it beside the checklist. It lists, soonest first and grouped into Overdue, This week, This month and Later:

- appointments, deadlines, deployment dates and other reminders the user adds;
- checklist steps with due dates;
- trip departure and return dates;
- the voucher due date, 5 working days after returning, until the voucher is submitted.

Added items and checklists are saved in this browser for the signed-in account and workspace; they do not sync to other devices yet. Syncing them would need a new server record type and migration.
