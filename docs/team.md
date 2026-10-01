# Leaders and their people

S1 reviewers, command approvers and admins open **Travel → My people** (`/dashboard/team`) and add service members from the workspace by the email they sign in with. An S1 reviewer adds people at **S1 · Administration**, a command approver at **Command approval**, and an admin at either. People must already be members of the workspace; the lookup never finds accounts outside it.

## Routing

When a service member submits an authorization, it goes to the S1 who added them, then to the command approver who added them, in that order. Nobody picks a reviewer. If neither has added them, the workspace routing an admin set up earlier is used; if there is none, the submission waits and is sent on as soon as a leader adds them. The traveler sees their S1 and command under **Settings → Your chain of command**. The old Settings → Approvers form is gone.

## What a leader sees

For each person: their trips with where each request stands (**Waiting on you** when it is at the leader's level), overdue items (voucher not filed after a trip, plan not sent within 7 days of leaving, checklist past due), planned, claimed and paid totals, and progress on checklists the leader sent. Team totals sit above the list. Leaders see only people they added; admins see everyone's teams. These records come from `ouranos.team_records`, not from sync, so a leader's own trip list stays their own.

## Checklists

**Send a checklist** gives selected people a title, steps (one per line) and an optional due date. People see them under **Travel → Checklists from your leaders**, tick off steps, and the leader sees the progress. Due dates also appear on the Upcoming calendar.

## Payments

Recorded payments are now saved to the account (`ouranos.trip_payments`) instead of the browser, so leaders see what was paid. Payments saved in a browser by the earlier version upload once and are cleared there.

## Applying the migration on the hosted project

`supabase/migrations/20261001000000_team_leaders.sql` adds the tables and functions. On the shared hosted project, export and review the batch, then apply it (see [cloud deployment](cloud-deployment.md)):

```sh
node platform/scripts/shared-project-migrations.mjs work/shared-project-migrations.sql
supabase db query --linked --file work/shared-project-migrations.sql
```

Apply it before or right after deploying. Until it is applied, submissions fall back to workspace routing, and My people, checklists and recorded payments report an error.
