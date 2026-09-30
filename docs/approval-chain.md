# Chain of command

Travel authorizations go up one or two levels:

| Level | Name | Account role |
| --- | --- | --- |
| 1 | S1 · Administration | `reviewer` |
| 2 | Command approval (command deck / CEO) | `approver` |

An administrator sets the chain in **Settings → Approvers**: the S1 reviewer's user ID is required, and the command approver's is optional. Leaving command empty makes S1 the only level. Each person must already have the matching role in **Team access**, and a traveler can never approve their own request.

## What the traveler sees

When an authorization is submitted, the request records each level as `pending` in `approval_requests.data.levels`. Each decision updates that level (`approved`, `changes_requested` or `rejected`, with the time and any comment) and the request's version, and syncs to the traveler.

- **Planning** shows one line saying where the request is: *With S1 · Administration · Step 1 of 2*, *With Command approval · Step 2 of 2*, or *Changes requested* / *Not approved* with the reviewer's comment. Once approved, the existing approved banner is shown instead.
- **Inbox** receives:
  - the existing *Authorization submitted* confirmation with the full submitted form, now with its current status;
  - *Approved by S1 · Administration* when level 1 approves and the request moves to command;
  - *Authorization approved* when the last level approves;
  - *Changes requested by …* or *Authorization not approved by …* when any level returns or rejects it, including the reviewer's comment.
- The next level's reviewer still receives *A travel submission needs review*. The review page labels each step by level.

Requests submitted before levels were recorded still work; they show a single review step based on the request's status. Changing the chain affects future submissions only; submitted requests keep the chain frozen at submission.

No database migration is needed: levels live in the request's JSON data and notifications use the existing notifications table.

## Verification

`platform/tests/approval-chain.test.ts` covers level names, decisions and notice wording. `platform/tests/connected-travel.integration.test.ts` checks, against a real database, that level 1 approval notifies the traveler and forwards to command, that final approval sends *Authorization approved*, and that reviewers do not receive the traveler's updates.
