# Railway deployment

`.railway/railway.ts` declares the existing Ouranos production services using the pinned `railway` SDK. Install dependencies with `npm ci`.

```sh
railway link --project ea152b79-8195-4d98-8d3d-3f0d373ad3d3 --environment production
railway config plan
railway config apply
```

Review the plan before applying it. `preserve()` retains service variables without putting secrets in Git. Do not export variables with `config pull --include-variables`.

Each service is connected to GitHub `main`, which is also the repository default branch. Watch patterns avoid rebuilding unrelated services. Code pushes deploy automatically; infrastructure changes require a separate plan/apply. The worker and scanner have no public domains.

See [cloud-deployment.md](../docs/cloud-deployment.md) for endpoints, spending limits, database isolation and verification results.
