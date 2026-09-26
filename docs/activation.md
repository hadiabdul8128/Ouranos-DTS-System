# Connected development environment

The repository contains a working local travel flow: email sign-in → trip → planning → Authorization review/approval → receipts and expenses → Voucher automatic verification. Records, originals, versions, decisions and audit events live in the shared backend. The home screen remains a single intent prompt. Travel opens a minimal trip list, then Plan → Expenses. New trips save and continue directly into planning. The Voucher rules and audit record are described in [voucher-auto-verification.md](voucher-auto-verification.md).

## Start locally

```sh
npm ci
supabase start
supabase migration up --local
npm run platform:local
npm run platform:seed
npm run platform:receipts
npm run platform:doctor
npm run platform:dev
```

`platform:receipts` builds and starts the optional ClamAV and Tesseract/Poppler containers, waits for readiness, generates a local token, and configures the host worker. It refuses nonlocal database/Auth endpoints. The first run downloads images and antivirus signatures. Provider configuration and keys stay in ignored files with owner-only filesystem permissions.

Use the frontend at `http://localhost:5173` and sign in through the local inbox at `http://127.0.0.1:56324`. Seeded accounts are `traveler@ouranos.test`, `reviewer@ouranos.test`, `approver@ouranos.test` and `admin@ouranos.test`. Each person uses a separate session; a traveler cannot approve their own request. Seeded routes run reviewer → approver. In a new organization, an administrator must explicitly assign its team and routes.

The worker processes uploaded receipts asynchronously. The traveler reviews extracted suggestions, confirms the receipt, matches actual expenses to approved budget items, resolves consistency exceptions, certifies the Voucher, and runs server verification. A clean Voucher is ready for external DTS review; Ouranos does not issue government approval or submit to DTS.

## Containerized API and worker

The setup creates `.env.platform.container` with `host.docker.internal` for host-local Supabase and service names for receipt processing. Once the host development API is stopped, the same backend can run in Docker:

```sh
OURANOS_CONTAINER_ENV_FILE=.env.platform.container docker compose --env-file .env.receipts -f compose.platform.yml --profile receipts up --build --wait
```

The API binds to host loopback on port 4100; the receipt adapter binds to loopback on 4200. ClamAV has no host port. Stop these services with the corresponding Compose `down` command; the named signature volume is retained. `supabase stop` separately stops Auth, database and storage. Do not run two competing development workers while a live receipt integration test is claiming its exact job.

## GitHub and checks

Repository: [hadiabdul8128/Ouranos-DTS-System](https://github.com/hadiabdul8128/Ouranos-DTS-System). The collaborator's `feature/companion-mvp` history is merged through `a78b559`. The shared platform uses its per-diem, lodging, receipt statement, checklist, evidence and encrypted-package functions. Original feature branches remain available. Rate input bounds, provided-meal incidental minimums and backup-envelope validation are tightened in the integrated version.

GitHub Actions checks contracts, types, unit tests, frontend and container builds, the standalone voucher module, and an isolated local Supabase integration suite. It receives no production credentials. Local integration additionally exercises real scan/OCR services when their loopback URLs are configured.

## Vercel frontend

The `ouranos` Vercel project is connected to this GitHub repository, with `main` as its production branch. `vercel.json` selects the native Next.js build (`npm run build:vercel`), while the existing local preview commands remain available. The Vercel project uses Node.js 24. `.vercelignore` excludes local credentials, service state and generated artifacts from CLI uploads. GitHub Actions checks both frontend builds.

The production frontend at [ouranos-fawn.vercel.app](https://ouranos-fawn.vercel.app) is configured with the hosted Railway API and Supabase Auth. Only the public API URL, Supabase URL and public Auth key are built into the frontend. Database and provider secrets stay in Railway.

## Cloud backend

The API, worker, receipt adapter and private scanner are live on Railway. PostgreSQL, Auth and private storage use the existing paid Supabase project, with Ouranos tables isolated in their own schema. The workspace has a $40 usage hard limit and $30 alert. Deployment configuration, verification results and email limitations are in [cloud-deployment.md](cloud-deployment.md).

GitHub `main` is the default and deployment branch. Changes to backend source paths trigger the corresponding Railway services. Infrastructure lives in `.railway/railway.ts`; review `railway config plan` before applying infrastructure changes. Supabase's built-in sender restricts email sign-in to project-team recipients; general-user access still requires SMTP setup.

Use production TLS, exact CORS/callback origins and server-only secrets. The worker requires direct PostgreSQL or **session pooling**, because per-job locks depend on a stable database session. Do not use a transaction pooler for workers. Build the frontend with the deployed API URL and public Auth settings only.

There is no live DTS connector or DTS credential configured. Connecting military systems requires an authorized interface and its actual protocol; local approvals and OCR do not supply that access.

## Companion integration

Per-diem settings and rate results are frozen at plan submission. The engine covers the branch's bundled CONUS FY2026/FY2027 rates; displayed values are estimates with a DTMO verification link, not an external entitlement decision. Unsupported travel cases retain manual budgets. Existing plans without allowance settings keep their prior behavior.

Lodging records store total, tax, fees and stay dates in integer cents. Lost-receipt statements bind to an expense version and are rebuilt from server records; editing the expense invalidates the statement. Online travel agency lodging cannot use this replacement. The server recomputes companion checks and still prevents duplicate active voucher claims.

After submission, `/v1/vouchers/:id/package` returns the immutable authorized snapshot, checklist and receipt references under the existing row-level permissions. Download creates a ZIP with printable `index.html`, `submission.json` and every original receipt, verified against its stored hash. An encrypted copy uses the companion's local AES-GCM backup format; “Open saved package” decrypts a saved archive locally and does not import approval authority. Packages above 50 MB require individual receipt downloads.

Policy references: [DTMO receipt guidance](https://www.travel.dod.mil/About/News/Article/Article/3642621/avoid-improper-dts-payments-by-checking-receipts/), [JTR](https://www.travel.dod.mil/Policy-Regulations/Joint-Travel-Regulations/), [GSA rate files](https://www.gsa.gov/travel/plan-a-trip/per-diem-rates/per-diem-files). Ouranos checks and internal approvals do not submit to DTS.

The GSA estimate retains the incidental amount when provided meals exhaust the travel-day M&IE, per [FTR 301-11.18](https://www.ecfr.gov/current/title-41/subtitle-F/chapter-301/subchapter-B/part-301-11/subpart-A/section-301-11.18). The review flow still requires verification of DoD-specific treatment.
