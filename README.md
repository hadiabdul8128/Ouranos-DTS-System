# Ouranos

A minimal operational workspace with a connected travel platform. The home screen stays simple: an animated Ouranos wordmark, email sign-in, then “What do you want to do?” Enter a travel request to begin.

The shared platform provides verified sessions, organization roles, planning, expenses, vouchers, private documents, an offline outbox, immutable submission revisions, approval routing and background jobs. The collaborator's voucher module is preserved in `voucher/`; its receipt parser and reconciliation logic are connected to the shared backend. Other workflows can use the same foundation later.

## Run the platform locally

Requires Node.js 22.13+, Docker and the Supabase CLI. Run from this directory:

```sh
npm install
supabase start
supabase migration up --local
npm run platform:local
npm run platform:contracts
npm run platform:seed
npm run platform:dev
```

Open [Ouranos](http://localhost:5173). Local email sign-in links appear in the [development inbox](http://127.0.0.1:56324). The seed creates `admin@ouranos.test`, `traveler@ouranos.test`, `reviewer@ouranos.test` and `approver@ouranos.test`, an organization, a synthetic trip, and approval routing. It can be run again without replacing existing records; it refuses nonlocal endpoints.

The API runs on port 4100; Supabase Auth/Storage on 56321, PostgreSQL on 56322 and Studio on 56323. `platform:dev` starts the frontend, API and worker together. Local setup writes ignored environment files and preserves existing configuration. See [operations](docs/operations.md) for configuration and individual commands.

## Current boundaries

- With all three public platform settings configured, email login uses Supabase and the API verifies access tokens. Without them, the frontend remains a local preview with unverified email; it does not gain authenticated API access. A hosted-site access gate is separate from Ouranos authentication.
- Planning and voucher forms use registered validators and immutable approved travel. The server checks persisted expenses and recomputes reconciliation. These are application consistency checks; organization reviewers remain responsible for travel-policy decisions. The fixture schema is never accepted in production.
- Local receipt processing uses the optional ClamAV, Tesseract and Poppler services. Unavailable providers never report successful processing. DTS remains unconnected; the development mock never reports external acceptance.
- An already open, verified workspace can retain drafts and receipts offline. Initial sign-in, submissions and decisions need a connection. The service worker does not cache private pages or API responses; this is not a fully offline application launch.
- This is a development foundation, not an operational deployment or an accreditation claim. The hosted frontend alone does not provision the API, worker, database or providers.

Read the [activation guide](docs/activation.md), [architecture](docs/architecture.md), [partner handoff](docs/partner-handoff.md), and generated [OpenAPI contract](docs/openapi.json). The running API also serves the contract at `/openapi.json`.

## Checks

```sh
npm run platform:contracts -- --check
npm run platform:check
npm run platform:test:integration
npm run voucher:test
npm run platform:doctor
npm run build
```

Integration tests use local Supabase and synthetic accounts. They cover database authorization, frozen approvals, real form submissions, server reconciliation, worker concurrency and recovery. When loopback scan/OCR services are enabled, an additional test verifies real receipt processing. No test sends travel to DTS.
