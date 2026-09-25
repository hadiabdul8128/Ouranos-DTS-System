# Hosted Ouranos

The frontend is [ouranos-fawn.vercel.app](https://ouranos-fawn.vercel.app), deployed from GitHub `main`. The backend uses Railway for the API, worker and receipt services, and Supabase for PostgreSQL, Auth and private receipt storage. Supabase migrations are applied to the existing paid project `mtjtggfacdkdncogxlvj` in `hadiabdul8128's Org`. The four Railway services are live. Vercel production is configured with the hosted API and public Supabase Auth settings.

## Railway services

The `ouranos` Railway project contains four services in its `production` environment, in San Francisco. All source builds use the repository root and GitHub `main`; `main` is also the repository default branch. Infrastructure is declared in [`.railway/railway.ts`](../.railway/railway.ts) using the pinned Railway SDK. The old per-service JSON format is deprecated and is no longer used.

Run `railway config plan` before applying infrastructure changes. Existing variables use `preserve()` so secrets stay in Railway. The Railway GitHub App is authorized for this repository, with verified `main` triggers on all four services. GitHub pushes deploy only services whose watched paths changed, after GitHub Actions passes (`checkSuites: true`). No Railway account token or production database credentials are stored in GitHub Actions. Infrastructure changes require a separate reviewed `railway config apply`; pushing the TypeScript file alone does not apply infrastructure.

| Service | Dockerfile | Network | Memory limit |
| --- | --- | --- | --- |
| api | `Dockerfile.platform` | [HTTPS API](https://api-production-e1e8.up.railway.app); readiness `/ready` | 500 MB |
| worker | `Dockerfile.platform` | No public domain | 500 MB |
| receipts | `Dockerfile.receipts` | [HTTPS receipt adapter](https://receipts-production-91b7.up.railway.app); bearer authentication; readiness `/ready` | 1 GB |
| scanner | `Dockerfile.scanner` | `scanner.railway.internal:3310`, private only | 4 GB |

Keep one replica per service and automatic sleeping off for the worker and scanner. The scanner image is the same pinned official ClamAV image used locally. It refreshes definitions at runtime. Receipt readiness rejects signatures older than seven days; it must become healthy before receipts are accepted. No public domain or TCP proxy is needed for the scanner. Its definitions are disposable, so it does not need a persistent user-data volume.

The paid Hobby workspace has a verified **$40 usage hard limit and $30 alert**, leaving room within the approved $50 monthly budget for the subscription and other charges. Railway stops workloads at its hard limit; this budget does not guarantee uninterrupted month-long service. Workspace limits affect every project in that workspace. Memory limits are maximums, not measurements of actual usage.

```sh
railway usage limit set --target workspace --soft 30 --hard 40 --workspace WORKSPACE_ID --json
railway usage limit status --target workspace --workspace WORKSPACE_ID --json
```

## Database and authentication

The owner selected the existing paid Supabase project. Ouranos tables live in the `ouranos` schema, alongside the other application's unchanged `public` tables. Auth users and email delivery settings are shared at the Supabase project level; Ouranos memberships and row policies determine access to Ouranos data.

For this shared project, use the separate checksum ledger in `ouranos.schema_migrations`. Do not use `supabase db reset` or change the existing application's `supabase_migrations` history. Export and review the atomic batch before applying it:

```sh
node platform/scripts/shared-project-migrations.mjs work/shared-project-migrations.sql
supabase db query --linked --file work/shared-project-migrations.sql
```

For a fresh, dedicated project or local development, the standard Supabase CLI migration workflow still applies. Never run local fixture seeds against a hosted project.

Use separate API and worker database logins. The API login has `NOINHERIT` and membership in `ouranos_api`; API transactions explicitly enter that restricted role. The worker login inherits `ouranos_worker`, which grants access to Ouranos tables and its queue without global RLS bypass or access to the other application's tables. Neither runtime uses the shared project's administrator password.

Use the project's direct database or session-pooler connection (port 5432) for the worker. Transaction pooling cannot preserve its job advisory locks. Require verified TLS. Credentials and the Supabase server key belong only in Railway service variables; never in browser variables, Git, Docker build arguments or logs.

The exact callback `https://ouranos-fawn.vercel.app/auth/callback` is allowed. Keep the existing site's primary URL and email settings unchanged. This project currently uses Supabase's built-in email delivery, which is limited to project-team recipients and low-volume testing. General-user sign-in requires a verified SMTP sender configured with the project owner.

## Service variables

Both `api` and `worker` need:

- `NODE_ENV=production`
- `DATABASE_URL` with the hosted session-pooler connection
- `DATABASE_SSL=verify-full`
- `DATABASE_CA_CERT`: the PEM CA certificate downloaded from Supabase Database Settings; certificate and hostname verification remain enabled.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- `ALLOWED_ORIGINS=https://ouranos-fawn.vercel.app`
- `DTS_PROVIDER=disabled`

The API listens on `HOST=0.0.0.0` and Railway's supplied `PORT`. Add another frontend origin only if that domain is deliberately supported and its Auth callback is also allowed.

The worker also needs `SCAN_PROVIDER=http`, `OCR_PROVIDER=http`, `WORKER_POLL_MS=2000`, the receipt service's HTTPS `/scan` and `/extract` URLs, and `SCAN_TOKEN` / `OCR_TOKEN`. Use a new random token of at least 32 characters for the hosted environment.

The `receipts` service receives that same token as `RECEIPT_PROVIDER_TOKEN`, with `CLAMD_HOST` pointing to the scanner's Railway private domain and `CLAMD_PORT=3310`. No Supabase or database credentials belong in either receipt-provider service.

## Frontend cutover

After API readiness and hosted workflow checks passed, these Vercel production variables were configured and the site was redeployed:

- `NEXT_PUBLIC_OURANOS_API_URL=https://api-production-e1e8.up.railway.app`.
- `NEXT_PUBLIC_SUPABASE_URL=https://mtjtggfacdkdncogxlvj.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's working public `anon` key. This existing project rejected the newer key format, so the verified legacy public/server key pair is used.

Only public API/Auth settings are supplied to Vercel. Database passwords, provider tokens and the Supabase server key remain server-side. Development and preview environments are separate from this production configuration.

Sign in using a real email link, create the Ouranos workspace, and assign actual reviewer/approver memberships and routes. These are application roles, separate from cloud-provider project membership. A traveler cannot approve their own request.

## Verification on 2026-09-25

Hosted smoke checks used four synthetic Auth users in an isolated Ouranos organization, through the public API. They passed persistent trip retrieval, cross-tenant denial, rejection of self/out-of-order approval, sequential planning approval, and the frozen approved handoff. A signed PDF upload passed the live background queue, ClamAV scan, Tesseract extraction, user confirmation and a hash-verified original download. A separate receipt-exempt meal passed voucher reconciliation, two-person approval and HTML package export. All synthetic users were disabled after the check. No real DTS submission was attempted.

API readiness returned 200; unauthenticated API/provider access returned 401. CORS allowed the canonical Vercel origin and did not allow an unrelated origin. All four Railway deployments succeeded from `main`.

Inbox delivery and the real owner’s email callback still need an interactive sign-in check. Built-in Supabase email restrictions remain in effect; password-authenticated synthetic API checks do not verify email delivery.

For future releases:
Check API readiness, rejection of an unauthenticated `/v1/session`, private receipt storage, successful email callback, and persistent trip state after refresh. Exercise planning review and approval with distinct assigned users, then upload a synthetic receipt and observe scan → extraction → confirmation → expense → voucher review → package download. Check tenant isolation and original receipt hashes. Verify worker logs and Railway usage limits without printing tokens or document contents.

Real DTS submission remains disabled until an authorized DTS interface is separately configured.

References: [Railway service configuration](https://docs.railway.com/infrastructure-as-code/reference), [Railway usage limits](https://docs.railway.com/cli/usage), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Temporary access without approval setup

Set the Railway API variable `APPROVAL_MODE=preview` to allow working plans,
receipt processing, and draft voucher exports without configured reviewers.
The session response controls the UI. Authentication, memberships, ownership,
and row-level security remain enforced. This mode does not create approvals
or submit anything to DTS; exported drafts are labeled accordingly.

Restore `APPROVAL_MODE=required` (the default) and redeploy the API to require
the normal approval workflow again. Existing drafts remain drafts.
