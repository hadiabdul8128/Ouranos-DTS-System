# Development and deployment notes

## Local setup

From the project directory, start Docker, install dependencies and run:

```sh
supabase start
supabase migration up --local
npm run platform:local
npm run platform:contracts
npm run platform:seed
npm run platform:dev
```

`platform:local` reads the local Supabase status and writes ignored `.env.platform` and `.env.local` files. It preserves existing configuration by default. Use `npm run platform:local -- --replace-local` only when intentionally regenerating the local server settings. The setup and seed scripts require loopback Auth and database endpoints. They do not create a cloud project.

`platform:seed` is repeatable and creates synthetic accounts, an organization, a trip, and reviewer → approver routes for authorizations and vouchers. It does not install partner form schemas or enable providers. Sign in as `traveler@ouranos.test`, `reviewer@ouranos.test`, `approver@ouranos.test` or `admin@ouranos.test`; open the resulting link from the [local email inbox](http://127.0.0.1:56324) in the same browser that requested it, because PKCE uses browser-held state.

| Service | Local address |
| --- | --- |
| Frontend | `http://localhost:5173` |
| API | `http://localhost:4100` |
| API health / database readiness | `/health` / `/ready` on the API |
| OpenAPI | `http://localhost:4100/openapi.json` |
| Supabase Auth and Storage | `http://127.0.0.1:56321` |
| PostgreSQL | `127.0.0.1:56322` |
| Supabase Studio | `http://127.0.0.1:56323` |
| Local email inbox | `http://127.0.0.1:56324` |

Run components separately with `npm run dev`, `npm run platform:api` and `npm run platform:worker`. Stop the combined process with Ctrl-C. `supabase stop` stops local services; avoid `supabase db reset` when you need to retain local drafts, accounts and audit history.

## Configuration

Use `.env.example` for browser settings and `.env.platform.example` for server settings. Never commit populated environment files. `OURANOS_ENV_FILE` optionally selects a different server environment file.

All three `NEXT_PUBLIC_OURANOS_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values are required for connected mode. They are public build-time settings. Without them, the frontend presents a local preview; a publishable key alone does not turn that preview into verified authentication. Rebuild the frontend when changing these settings.

The API and worker require `DATABASE_URL`, `SUPABASE_URL`, a publishable key and a server secret. Those credentials stay in server processes. `ALLOWED_ORIGINS` controls browser CORS and must match the actual frontend origins. The API defaults to loopback binding on port 4100. Production requires `DATABASE_SSL=verify-full`; configure trusted database TLS accordingly.

Run `npm run platform:receipts` to start and connect the local ClamAV/Tesseract services. Other deployments can provide both HTTP adapter URLs and server tokens. Explicitly reprocess waiting documents after a provider is enabled. DTS remains disabled; mock is development-only. See [activation](activation.md) and [partner handoff](partner-handoff.md).

## Checks and failure investigation

```sh
npm run platform:contracts -- --check
npm run platform:check
npm run platform:test:integration
npm run build
```

Unit tests cover shared constraints, immutable local outbox behavior, conflict handling and synchronization recovery. Integration tests need the local stack and create synthetic Auth/database records. They use injected receipt providers; they do not call live scanning, OCR or DTS services. The test suite is not a production load, penetration or accreditation assessment.

`/health` confirms the API process is alive. `/ready` checks database connectivity only; it does not prove Auth, Storage or providers are healthy. The workspace surfaces synchronization failures and blocked commands. API error responses include a stable code and may include a request id. Logs redact authorization headers and omit database error values.

Inspect `failed_jobs`, `job_results` and the pgmq queue in the local database when investigating worker failures. Failed jobs retry with bounded backoff and move to `failed_jobs` after five reads. A disabled receipt provider is waiting configuration, not success. Do not delete audit history or rewrite submitted revisions to resolve failures.

## Deployment boundary

Deploy the frontend, Node API and Node worker as distinct runtime services with reachable Supabase Auth/Storage and PostgreSQL. The frontend's Sites hosting configuration does not provision these backend services. A static/frontend deployment must not bake in loopback API URLs or local credentials.

Before a real environment is enabled, supply its real email/identity configuration, allowed callback URLs, database and storage permissions, server secrets, partner validators and explicitly authorized provider connections. Define backups, retention, device/offline data policy, operational monitoring and recovery for that environment. The current repository does not claim these external services or organizational controls are complete.

Workers perform provider calls outside organization transactions. They claim work, renew the queue lease, and revalidate version/status/ownership before finalizing. Per-job locks require direct PostgreSQL or session pooling; transaction pooling is unsupported for workers. The bootstrap endpoint still caps visible data per entity kind. No Redis or Kubernetes is required.
