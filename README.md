# Ouranos

A minimal operational workspace with a travel platform skeleton. The home screen stays simple: an animated Ouranos wordmark, email sign-in, then “What do you want to do?” Enter a travel request to begin.

The shared platform provides verified sessions, organization roles, trip drafts, document storage, an offline outbox, immutable submission revisions, approval routing and background jobs. Planning and voucher forms are explicit partner integration points. Other Ouranos workflows can use the same foundation later.

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
- Planning and voucher screens are integration slots. Drafts accept versioned partner form data, but submission fails closed until a matching server validator is installed. The development fixture schema is never accepted in production.
- OCR, file scanning and DTS delivery default to disabled. Receipt processing waits for providers. The development DTS mock records a simulation and never reports external acceptance.
- An already open, verified workspace can retain drafts and receipts offline. Initial sign-in, submissions and decisions need a connection. The service worker does not cache private pages or API responses; this is not a fully offline application launch.
- This is a development foundation, not an operational deployment or an accreditation claim. The hosted frontend alone does not provision the API, worker, database or providers.

Read the [architecture](docs/architecture.md), [partner handoff](docs/partner-handoff.md), and generated [OpenAPI contract](docs/openapi.json). The running API also serves the contract at `/openapi.json`.

## Checks

```sh
npm run platform:contracts -- --check
npm run platform:check
npm run platform:test:integration
npm run build
```

Integration tests use the local Supabase stack and synthetic accounts. They exercise database authorization, command replay/version conflicts, frozen approvals, document verification and provider-injected receipt processing. They do not test live DTS, OCR or production authentication delivery.
