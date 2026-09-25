# Partner module handoff

Contract version: `1.0.0`. The shared sources are `packages/contracts/index.ts`, `packages/sdk/index.ts` and `packages/domain/modules.ts`. Generate the OpenAPI document with `npm run platform:contracts`; `-- --check` verifies the committed output and route inventory without rewriting it.

## Integration slots

| Module | Route | Owned data | Submission validator |
| --- | --- | --- | --- |
| Planning | `/dashboard/travel/planning?tripId=<uuid>` | Authorization form under an existing trip | `modules/planning/validator.ts` |
| Vouchers | `/dashboard/travel/vouchers?tripId=<uuid>` | Receipts, expenses and voucher form | `modules/vouchers/validator.ts` |

Replace the module slot with the partner screen while reusing `usePlatform()` for the current session, organization, repository and client. Read the selected trip from its id; do not duplicate identity, organization selection, synchronization, receipt storage or approval routing inside each form. Handle missing trips and unavailable membership explicitly.

Choose a stable `formSchemaVersion`, then implement its server validator before enabling submission. Draft storage accepts arbitrary form versions so work can be saved during integration. Submission currently accepts only `ouranos.fixture.v1` in development/test: planning requires a truthy `purpose`, and vouchers require `certified: true`. These are synthetic test fixtures, not usable travel policy validators. All other versions, and fixture versions in production, fail closed.

## Draft commands

Use the local repository for these offline-capable operations:

```ts
const authorizationId = crypto.randomUUID();
await platform.repository!.stage('authorization.save', authorizationId, {
  tripId,
  formSchemaVersion: 'partner.planning.v1',
  formData: validatedDraft,
});
await platform.engine?.sync();
```

`stage` validates the shared envelope and saves the draft plus queued command in one IndexedDB transaction. Supported offline commands are `trip.save`, `authorization.save`, `expense.save`, `voucher.save` and `document.register`. Use `captureReceipt(tripId, file)` to atomically retain receipt bytes and registration metadata. Currency is an uppercase three-letter code; expense amounts are integer minor units, never floating-point currency values. Dates are calendar strings (`YYYY-MM-DD`) and must round-trip to a real date.

Do not mutate a queued envelope. Lost acknowledgments must retry the original command id and content. A changed user intention creates a new command id. `expectedVersion: 0` creates an entity; updates use its current version. Blocked conflicts need comparison with the server state and an explicit user choice. Exporting pending commands does not export receipt blobs.

## Online actions and approval

Before submission, finish synchronization and inspect any blocked records or files. Send `authorization.submit` or `voucher.submit` through the client with a new command id, the current server version and a device id owned by the current user/organization. Do not reuse another user's device id. The API checks installed validators, ownership, routing and dependency readiness; a frontend button cannot bypass them.

`OuranosClient.command()` throws `ApiFailure` for non-2xx responses. `push()` returns per-command results for domain rejections; inspect every result. A batch is ordered but commits commands independently. Top-level request failures can occur after earlier commands committed, so repeat the exact envelopes when recovering.

Approval screens use `/v1/approvals/{id}/revision` to read frozen content and history. Decisions use `approval.decide`; routing and assignee checks run server-side. Show the exact revision being reviewed. A revision's SHA-256 value is a content digest, not a digital signature or a DTS receipt.

## Receipts and provider contracts

Registration accepts JPEG, PNG and PDF files up to 20 MiB. The flow is register → request signed upload URL → upload bytes → `document.finalize` → worker processing → `needs_review` → `document.confirm` → `ready`. The server verifies stored bytes against registered size, type signature and SHA-256. A signed download URL is issued only for a visible document in `needs_review` or `ready` and lasts 60 seconds.

Both scan and OCR adapters must be enabled for processing. HTTP providers receive the original bytes as the POST body with its media type, `X-Document-Id`, an `Idempotency-Key`, and an optional server-only bearer token. Scan returns `{ "clean": true }` or false. OCR returns:

```json
{
  "modelVersion": "partner-model-v1",
  "fields": [
    { "name": "merchant", "value": "Synthetic hotel", "confidence": 0.98, "page": 1 }
  ]
}
```

The runtime schema in `platform/worker/providers.ts` bounds field count, names, values and confidence. Provider calls time out after 30 seconds, do not follow redirects, and require HTTPS in production. Preserve idempotency keys in downstream processing. Do not put provider credentials in browser code or public environment variables.

`integration.request` queues an approved revision for delivery, but no live DTS connector exists. The disabled and mock implementations cannot claim external acceptance. A real connector needs its own authorization, delivery protocol, reconciliation and externally issued receipt semantics.

## Validation to add with a real module

Add shared-schema tests for actual form versions, server submission rejection tests, a complete authorized approval path, and receipt/expense dependencies for vouchers. Include malformed dates, currency totals, access separation, stale versions, duplicate command delivery and reconnect recovery. Run the existing platform checks and local integration suite after the module joins the shared flow.
