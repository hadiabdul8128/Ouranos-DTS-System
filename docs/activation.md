# Connected development environment

The repository contains a working local travel flow: email sign-in → trip → planning → review/approval → receipts and expenses → voucher → review/approval. Records, originals, versions, decisions and audit events live in the shared backend. The home screen remains a single intent prompt.

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

The worker processes uploaded receipts asynchronously. The traveler reviews extracted suggestions, confirms the receipt, matches actual expenses to approved budget items, resolves consistency exceptions, certifies the voucher and sends it for review. This records an Ouranos approval, never fabricated DTS acceptance.

## Containerized API and worker

The setup creates `.env.platform.container` with `host.docker.internal` for host-local Supabase and service names for receipt processing. Once the host development API is stopped, the same backend can run in Docker:

```sh
OURANOS_CONTAINER_ENV_FILE=.env.platform.container docker compose --env-file .env.receipts -f compose.platform.yml --profile receipts up --build --wait
```

The API binds to host loopback on port 4100; the receipt adapter binds to loopback on 4200. ClamAV has no host port. Stop these services with the corresponding Compose `down` command; the named signature volume is retained. `supabase stop` separately stops Auth, database and storage. Do not run two competing development workers while a live receipt integration test is claiming its exact job.

## GitHub and checks

Repository: [hadiabdul8128/Ouranos-DTS-System](https://github.com/hadiabdul8128/Ouranos-DTS-System). The collaborator's `voucher/` module comes from commit `8ce5197` and is preserved unchanged, including its lockfile and tests. The shared platform integrates that history on `main`; the `feature/voucher-copilot` branch remains available.

GitHub Actions checks contracts, types, unit tests, frontend and container builds, the standalone voucher module, and an isolated local Supabase integration suite. It receives no production credentials. Local integration additionally exercises real scan/OCR services when their loopback URLs are configured.

## Cloud activation still requires an environment

Local services are not a hosted deployment. The existing published frontend preview does not reach this computer's database. A cloud environment needs a dedicated Supabase project, verified email configuration, and reachable API, worker and receipt services. The Ouranos Supabase organization exists; a cloud project/runtime must be selected before provisioning or uploading credentials.

Use production TLS, exact CORS/callback origins and server-only secrets. The worker requires direct PostgreSQL or **session pooling**, because per-job locks depend on a stable database session. Do not use a transaction pooler for workers. Build the frontend with the deployed API URL and public Auth settings only.

There is no live DTS connector or DTS credential configured. Connecting military systems requires an authorized interface and its actual protocol; local approvals and OCR do not supply that access.
