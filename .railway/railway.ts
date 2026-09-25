import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const OuranosDTSSystem = github("hadiabdul8128/Ouranos-DTS-System", { branch: "main", checkSuites: true });

  const receipts = service("receipts", {
    source: OuranosDTSSystem,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.receipts", watchPatterns: ["/platform/providers/**", "/voucher/src/**", "/voucher/package.json", "/Dockerfile.receipts"] },
    start: "node platform/providers/server.mjs",
    healthcheck: "/ready",
    healthcheckTimeout: 600,
    replicas: { "sfo": 1 },
    deploy: { drainingSeconds: 35, limitOverride: { containers: { cpu: 1, memoryBytes: 1000000000 } }, restartPolicyMaxRetries: 5 },
    env: { CLAMD_HOST: preserve(), CLAMD_PORT: preserve(), HOST: preserve(), NODE_ENV: preserve(), PORT: preserve(), RECEIPT_PROVIDER_TOKEN: preserve() },
  });
  const scanner = service("scanner", {
    source: OuranosDTSSystem,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.scanner", watchPatterns: ["/Dockerfile.scanner"] },
    replicas: { "sfo": 1 },
    deploy: { drainingSeconds: 30, limitOverride: { containers: { cpu: 2, memoryBytes: 4000000000 } }, restartPolicyMaxRetries: 5 },
    env: { FRESHCLAM_CHECKS: preserve() },
  });
  const worker = service("worker", {
    source: OuranosDTSSystem,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.platform", watchPatterns: ["/platform/**", "/packages/**", "/modules/**", "/voucher/src/**", "/voucher/package.json", "/docs/openapi.json", "/Dockerfile.platform", "/package.json", "/package-lock.json"] },
    start: "node --import tsx platform/worker/main.ts",
    replicas: { "sfo": 1 },
    deploy: { drainingSeconds: 120, limitOverride: { containers: { cpu: 1, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 5 },
    env: { ALLOWED_ORIGINS: preserve(), DATABASE_CA_CERT: preserve(), DATABASE_SSL: preserve(), DATABASE_URL: preserve(), DTS_PROVIDER: preserve(), NODE_ENV: preserve(), OCR_PROVIDER: preserve(), OCR_TOKEN: preserve(), OCR_URL: preserve(), SCAN_PROVIDER: preserve(), SCAN_TOKEN: preserve(), SCAN_URL: preserve(), SUPABASE_PUBLISHABLE_KEY: preserve(), SUPABASE_SECRET_KEY: preserve(), SUPABASE_URL: preserve(), WORKER_POLL_MS: preserve() },
  });
  const api = service("api", {
    source: OuranosDTSSystem,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile.platform", watchPatterns: ["/platform/**", "/packages/**", "/modules/**", "/voucher/src/**", "/voucher/package.json", "/docs/openapi.json", "/Dockerfile.platform", "/package.json", "/package-lock.json"] },
    start: "node --import tsx platform/api/server.ts",
    healthcheck: "/ready",
    healthcheckTimeout: 120,
    replicas: { "sfo": 1 },
    deploy: { drainingSeconds: 30, limitOverride: { containers: { cpu: 1, memoryBytes: 500000000 } }, restartPolicyMaxRetries: 5 },
    env: { ALLOWED_ORIGINS: preserve(), DATABASE_CA_CERT: preserve(), DATABASE_SSL: preserve(), DATABASE_URL: preserve(), DTS_PROVIDER: preserve(), HOST: preserve(), NODE_ENV: preserve(), OCR_PROVIDER: preserve(), PORT: preserve(), SCAN_PROVIDER: preserve(), SUPABASE_PUBLISHABLE_KEY: preserve(), SUPABASE_SECRET_KEY: preserve(), SUPABASE_URL: preserve(), WORKER_POLL_MS: preserve() },
  });

  return project("ouranos", {
    resources: [receipts, scanner, worker, api],
  });
});
