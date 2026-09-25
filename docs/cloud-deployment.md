# Hosted Ouranos

The frontend is [ouranos-fawn.vercel.app](https://ouranos-fawn.vercel.app), deployed from GitHub `main`. The backend uses Railway for the API, worker and receipt services, and Supabase for PostgreSQL, Auth and private receipt storage. Supabase migrations are applied to the existing paid project `mtjtggfacdkdncogxlvj` in `hadiabdul8128's Org`. Railway activation and the frontend cutover remain pending; configuration files alone do not mean services are live.

## Railway services

Create one Ouranos project with four services. All source builds use the repository root and `main`. Set each service's config-file path explicitly; these are separate service configurations, not four replicas of the frontend.

| Service | Config file | Network | Initial memory limit |
| --- | --- | --- | --- |
| api | `/deploy/railway/api.json` | Public HTTPS; readiness `/ready` | 512 MB |
| worker | `/deploy/railway/worker.json` | No public domain | 512 MB |
| receipts | `/deploy/railway/receipts.json` | Public HTTPS with bearer authentication; readiness `/ready` | 1 GB |
| scanner | `/deploy/railway/scanner.json` | Private TCP 3310 only | 4 GB |

Keep one replica per service and automatic sleeping off for the worker and scanner. The scanner image is the same pinned official ClamAV image used locally. It refreshes definitions at runtime. Receipt readiness rejects signatures older than seven days; it must become healthy before receipts are accepted. No public domain or TCP proxy is needed for the scanner. Its definitions are disposable, so it does not need a persistent user-data volume.

Apply a workspace compute hard limit before starting deployments. For a $50 monthly budget, use a conservative $40 compute limit and $30 alert to leave headroom for subscription/tax charges; verify the current billing terms. Railway stops workloads at its hard limit. Do not deploy until the limit is confirmed active. Workspace limits affect every project in that workspace.

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

Only after the API passes `/ready`, configure these Vercel production variables and redeploy:

- `NEXT_PUBLIC_OURANOS_API_URL`: the API's public HTTPS origin.
- `NEXT_PUBLIC_SUPABASE_URL`: the hosted Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: that project's publishable key.

Until then, leave the existing frontend in its explicitly labeled preview mode. Do not connect the public website to a localhost URL or tunnel the development database.

Sign in using a real email link, create the Ouranos workspace, and assign actual reviewer/approver memberships and routes. These are application roles, separate from cloud-provider project membership. A traveler cannot approve their own request.

## Verify the deployment

Check API readiness, rejection of an unauthenticated `/v1/session`, private receipt storage, successful email callback, and persistent trip state after refresh. Exercise planning review and approval with distinct assigned users, then upload a synthetic receipt and observe scan → extraction → confirmation → expense → voucher review → package download. Check tenant isolation and original receipt hashes. Verify worker logs and Railway usage limits without printing tokens or document contents.

Real DTS submission remains disabled until an authorized DTS interface is separately configured.

References: [Railway service configuration](https://docs.railway.com/config-as-code/reference), [Railway usage limits](https://docs.railway.com/cli/usage), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
