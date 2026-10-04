# Chain of command

Travel authorizations go up one or two levels:

| Level | Name | Account role |
| --- | --- | --- |
| 1 | S1 · Administration | `reviewer` |
| 2 | Command approval (command deck / CEO) | `approver` |

Each service member's S1 and command are the leaders who added them under **My people** (see [leaders and their people](team.md)); nobody picks a reviewer. Workspace routing set up earlier by an admin is still used for people no leader has added.

## Before approvers are set

Submitting never fails just because approvers are missing. The submission is frozen, the authorization moves to review, and the traveler receives the full *Authorization submitted* confirmation marked as waiting for approvers. Planning shows *Submitted · waiting for approvers*. Once a leader adds them, the next time the traveler opens that plan it is sent to S1 automatically (a repeated `authorization.submit` on the waiting authorization); it is never sent twice.

## What the traveler sees

After submitting, the traveler is taken to the inbox with the confirmation open. When an authorization is routed, the request records each level as `pending` in `approval_requests.data.levels`. Each decision updates that level (`approved`, `changes_requested` or `rejected`, with the time and any comment) and the request's version, and syncs to the traveler.

- **Planning** shows one line saying where the request is: *With S1 · Administration · Step 1 of 2*, *With Command approval · Step 2 of 2*, or *Changes requested* / *Not approved* with the reviewer's comment. Once approved, the existing approved banner is shown instead.
- **Inbox** receives:
  - the existing *Authorization submitted* confirmation with the full submitted form, now with its current status;
  - *Approved by S1 · Administration* when level 1 approves and the request moves to command;
  - *Authorization approved* when the last level approves;
  - *Changes requested by …* or *Authorization not approved by …* when any level returns or rejects it, including the reviewer's comment.
- The next level's reviewer still receives *A travel submission needs review*. The review page labels each step by level.

Requests submitted before levels were recorded still work; they show a single review step based on the request's status. Changing the chain affects future submissions only; submitted requests keep the chain frozen at submission.

No database migration is needed: levels live in the request's JSON data and notifications use the existing notifications table.

## Demo approval

Every workspace, including newly created workspaces, offers **Approve for demo** after a traveler submits their own authorization. This approves the frozen submission and opens its voucher. Every skipped approval step and the audit record are marked **Approved for demo**; normal submissions still use the assigned reviewer sequence. Authentication, active workspace membership, traveler ownership, and submitted-revision checks remain required.

Demo access defaults to `DEMO_APPROVAL_ALL_WORKSPACES=true`. Deployments can explicitly set it to `false` to use the `DEMO_APPROVAL_ORGANIZATIONS` workspace allowlist instead. The session response includes the global capability and each active membership’s workspace ID for compatibility with older clients. No workspace-by-workspace setup or database migration is needed.

## Verification

`platform/tests/approval-chain.test.ts` covers level names, decisions and notice wording. `platform/tests/connected-travel.integration.test.ts` checks, against a real database, that level 1 approval notifies the traveler and forwards to command, that final approval sends *Authorization approved*, and that reviewers do not receive the traveler's updates.
