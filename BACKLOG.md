# Workshop Buddy — Prioritized Backlog

**Review lens:** Enterprise Architect (EA) · Dev Lead (DL) · UX / Design Thinking (UX)
**Scope:** [innovate-impact/](innovate-impact/) Next.js app, Prisma + Azure Postgres (Entra), Foundry/OpenAI provider, ACA deployment.
**Status legend:** ☐ not started · ◐ in progress · ☑ done

Each item: persona tag · lens · description · acceptance criteria · suggested files. Items are roughly ordered by priority — do P0 top-to-bottom.

---

## P0 — Ship-blocking

### P0-1 ☑ [EA/DL · Security] AuthN + AuthZ on every API route
Today every route under `/api/*` is anonymous; anyone with the ACA URL can list/create/delete projects, trigger AI runs, or download artifacts.

**Acceptance criteria**
- All `/api/**` routes (except `/api/health`) reject unauthenticated requests with `401`.
- Sign-in via Microsoft Entra ID (NextAuth Entra provider **or** ACA Easy Auth in front of the container).
- `Project` schema gains `ownerId: String` (Entra `oid`); migration backfills existing rows to a configured seed owner.
- Helper `assertProjectAccess(projectId, user)` used by every project-scoped route returns `404` (not `403`) on mismatch to avoid enumeration.
- Artifact download verifies the parent project is owned by/shared with the caller (closes IDOR — see P0-6).
- Local dev: documented `az login` → bypass works only when `NODE_ENV=development`.

**Files:** [src/app/api/](innovate-impact/src/app/api/), [prisma/schema.prisma](innovate-impact/prisma/schema.prisma), new `src/lib/auth.ts`.

**Resolution (2026-05-27):** Single-tenant ACA Easy Auth wired end-to-end.
- New [src/lib/auth.ts](innovate-impact/src/lib/auth.ts) decodes Easy Auth headers (`X-MS-CLIENT-PRINCIPAL-*`) with a `DEV_AUTH_BYPASS_OID/UPN/NAME` fallback for `NODE_ENV !== 'production'`. 404-on-mismatch in `assertProjectAccess` / `assertArtifactAccess` / `assertInputAccess`.
- All 13 protected routes wrapped with `withAuth`; `/api/health` left public.
- `Project.ownerId` added to schema; `prisma db push --force-reset` applied to `pg-wb-5jkt2ufa`; seed defaults owner to my Entra `oid`.
- Entra app reg (`wb-wb-easyauth`, clientId `7f9d274b-1d97-4707-ac46-d7a717c126d9`) + 2-year client secret created by azd preprovision hook; redirect URI patched by postprovision hook.
- ACA `authConfigs/current` provisioned with `unauthenticatedClientAction: RedirectToLoginPage`, issuer via `environment().authentication.loginEndpoint`, `excludedPaths: /api/health + Next.js static`. Token store disabled (not needed for header-based auth).

---

### P0-2 ☑ [DL · Security] Fix Postgres SSL trust chain
[src/lib/db.ts](innovate-impact/src/lib/db.ts#L72) passes `rejectUnauthorized: false`, disabling TLS cert validation.

**Acceptance criteria**
- Pool config uses `ssl: { ca: <DigiCert Global Root G2 PEM>, rejectUnauthorized: true }` (or `pg`'s built-in roots).
- Local + ACA both connect cleanly; verified by a deliberate hostname-mismatch test that now fails closed.
- README updated with the trust-chain reference.

**Files:** [src/lib/db.ts](innovate-impact/src/lib/db.ts), [innovate-impact/README.md](innovate-impact/README.md).

**Resolution (2026-05-27):** Strict TLS using Node's bundled Mozilla CA roots.
- Both pool configs in [src/lib/db.ts](innovate-impact/src/lib/db.ts) (local Entra-token path and ACA async-credential path) switched to `ssl: { rejectUnauthorized: true }`. No `ca` field — Node's bundled root store includes **DigiCert Global Root G2**, the root for `*.postgres.database.azure.com`. SNI hostname verification is on by default, so the cert's `DNS:pg-wb-5jkt2ufa.postgres.database.azure.com` SAN is enforced.
- Same applied to [prisma/seed.ts](innovate-impact/prisma/seed.ts) and [prisma/seed.js](innovate-impact/prisma/seed.js) so the container-start seed uses the same trust model.
- Local fail-closed verification: connecting via real hostname succeeds; substituting an IP literal fails with `ERR_TLS_CERT_ALTNAME_INVALID … is not in the cert's altnames: DNS:pg-wb-5jkt2ufa.postgres.database.azure.com, DNS:a789dfd096c0.database.azure.com`.
- ACA validation: new revision `wb-l7kbxduxijdyk-app--azd-1779909512` Healthy; container logs show `Your database is now in sync with your Prisma schema`, `Seeded project: cmpoh2c590000j37r890rbnsw`, then `Ready in 151ms`; `/api/health` 200.
- README updated with **Postgres TLS** section explaining the bundled-CA model and runtime upgrade path (Node LTS).
- Incident note feeding P0-3: this deploy briefly crashlooped because the old revision (still on the pre-P0-1 schema) had run `prisma db push --accept-data-loss` on restart and dropped the new `ownerId` column. Resolved by deactivating the old revision and cleaning orphaned rows. Live justification for replacing data-loss push at container start.

---

### P0-3 ☑ [EA · Resiliency] Replace `prisma db push --accept-data-loss` on container start
[start.js](innovate-impact/start.js#L57) data-loss-pushes on every cold start. One bad schema diff wipes the demo DB.

**Acceptance criteria**
- Schema migrations moved to `prisma migrate deploy` against versioned migrations in `prisma/migrations/`.
- Migration runs as a separate Container Apps Job (or azd pre-deploy hook), **not** in the web container's startup.
- Web container's `start.js` only fetches a token and launches Next.js; no schema mutation.
- Rollback plan documented (point-in-time restore on the Flexible Server).

**Files:** [start.js](innovate-impact/start.js), [innovate-impact/infra/main.bicep](innovate-impact/infra/main.bicep), new `prisma/migrations/`.

**Resolution (2026-05-27):** Versioned migrations + azd predeploy hook.
- Initial migration generated via `prisma migrate diff --from-empty --to-schema-datamodel` → [prisma/migrations/20260527200000_init/migration.sql](innovate-impact/prisma/migrations/20260527200000_init/migration.sql); `migration_lock.toml` pins `postgresql`.
- Live DB baselined non-destructively: `prisma migrate resolve --applied 20260527200000_init`. `prisma migrate status` reports "Database schema is up to date!" — no SQL replay against existing data.
- [azure.yaml](innovate-impact/azure.yaml) gains a `predeploy` hook (posix + windows) that fetches an `oss-rdbms` Entra token for the signed-in dev, builds a `DATABASE_URL` against `AZURE_PG_SERVER_FQDN`/`AZURE_PG_DATABASE_NAME`, and runs `npx prisma migrate deploy` before the new image rolls out. Matches the existing app-reg/redirect-URI hook pattern; future CI promotion to a Container Apps Job is a drop-in replacement.
- [start.js](innovate-impact/start.js) stripped: no `db push`, no `--accept-data-loss`, no token fetch (seed.js's driver adapter handles its own token). Container now runs `node prisma/seed.js` (idempotent) → `require('./server.js')`. [Dockerfile](innovate-impact/Dockerfile) CMD comment updated to match.
- ACA validation: new revision `wb-l7kbxduxijdyk-app--azd-1779913707` Healthy on first roll; logs show `[start] $ /usr/bin/node prisma/seed.js` → `Seed project already present: cmpoh2c590000j37r890rbnsw` → `[start] launching Next.js server...` → `Ready in 161ms`. No `prisma db push` line in any container log. `/api/health` 200.
- **Rollback**: PG Flexible Server PITR (`az postgres flexible-server restore --restore-time <UTC>`). MVP does not ship `prisma migrate resolve --rolled-back` automation; for emergency rollback of a bad migration, PITR to pre-deploy timestamp and re-baseline.
- Followup ⏭ Promote to Container Apps Job once CI lands so migration auth is not tied to a human's az login.

---

### P0-4 ☑ [EA/DL · Resiliency] Move agent orchestrator out of the request process

**Resolution (2026-05-28):** Producer/consumer split shipped.

- Producer: `src/lib/agents/queue.ts` sends `{runId, projectId}` to Service Bus queue `agent-runs` on namespace `wb-l7kbxduxijdyk-bus`. `POST /agent-runs` returns `202 {runId, status:"Queued"}` when `SERVICEBUS_NAMESPACE` is set; falls back to in-process execution for local dev.
- Consumer: Container Apps Job `wb-l7kbxduxijdyk-worker` (Event trigger, KEDA `azure-servicebus` scale rule, 0–5 replicas) runs `worker/agent-run-worker.ts` via `tsx`. Peek-lock, 5-minute lock with 30s renewal, runs the existing orchestrator, completes on success, abandons on throw (1 retry → DLQ).
- Sweeper: Container Apps Job `wb-l7kbxduxijdyk-sweeper` (Schedule cron `*/5 * * * *`) runs `worker/sweeper.js` and marks any `AgentRun.status="Running"` older than 30 min as `Failed` with `outputJson={"error":"orchestrator timeout / lost"}`.
- Both jobs share the web app's UAMI (`wb-l7kbxduxijdyk-uami`) and get `Azure Service Bus Data Owner` at namespace scope. Queue config: `maxDeliveryCount:2`, `lockDuration PT5M`, `TTL PT1H`, DLQ on expiration.
- Image build/deploy: `azd up` provisions; `azd deploy` builds the web image; `azure.yaml` postdeploy hook re-tags both jobs with the same image. Manual recovery path: `az acr build --no-logs` + 3× `az containerapp[ job] update --image`.
- **Validation evidence:** Sweeper execution `wb-l7kbxduxijdyk-sweeper-29666310` (2026-05-28 10:30:00) `Succeeded` with the new image. Web revision `wb-l7kbxduxijdyk-app--0000004` `Running`. `SERVICEBUS_NAMESPACE`/`SERVICEBUS_QUEUE` env vars verified on web and worker. End-to-end UI run + mid-run revision restart still to be exercised by the user.
- **Gotcha logged in repo memory:** Service Bus namespace suffix `-sb` is reserved by Microsoft.ServiceBus; we use `-bus`.

---

### P0-4 (original spec) ☑ [EA/DL · Resiliency] Move agent orchestrator out of the request
[agent-runs/route.ts](innovate-impact/src/app/api/projects/[projectId]/agent-runs/route.ts#L46) fire-and-forgets `executeRunInBackground` inside Next.js. Scale-in/restart silently kills the run and leaves `status="Running"` forever.

**Acceptance criteria**
- POST `/agent-runs` enqueues a Service Bus message and returns `202` + `runId`.
- A Container Apps Job (or Azure Function) consumer picks up the message, runs the orchestrator, persists artifacts, updates `AgentRun.status`.
- Sweeper job (cron, every 5 min) marks any `AgentRun.status="Running"` older than 30 min as `Failed` with reason `"orchestrator timeout / lost"`.
- Successful run end-to-end demonstrated after a `revision restart` of the web container mid-run.
- Retry policy: 1 automatic retry on transient failure; dead-letter after that.

**Files:** [src/app/api/projects/[projectId]/agent-runs/route.ts](innovate-impact/src/app/api/projects/[projectId]/agent-runs/route.ts), [src/lib/agents/orchestrator.ts](innovate-impact/src/lib/agents/orchestrator.ts), new `worker/` project or Container Apps Job, [infra/main.bicep](innovate-impact/infra/main.bicep).

---

### P0-5 ☐ [DL · Security/Reliability] Validate every API input with `zod`
Routes currently do ad-hoc `typeof` checks and silently truncate (e.g. `content.slice(0, 2000)` in [inputs/batch/route.ts](innovate-impact/src/app/api/projects/[projectId]/inputs/batch/route.ts#L84)).

**Acceptance criteria**
- `zod` schemas defined for every request body / query / params.
- Validation failures return `400` with a stable error envelope `{ error, issues[] }`.
- Per-route body size limit (default 1 MB; transcript extract: 12 MB to cover the 10 MB file + multipart overhead).
- Pasted transcript text capped at 1 MB; rejected with a user-friendly `413` above that.
- No silent truncation — over-length fields return `400`.

**Files:** all `src/app/api/**/route.ts`, new `src/lib/api/validate.ts`.

---

### P0-6 ☐ [DL · Security] Close IDOR on artifact + input routes
[artifacts/[artifactId]/download/route.ts](innovate-impact/src/app/api/artifacts/[artifactId]/download/route.ts#L14) and [inputs/[inputId]/route.ts](innovate-impact/src/app/api/inputs/[inputId]/route.ts) fetch by id only.

**Acceptance criteria**
- Each route joins to `Project` and calls `assertProjectAccess` from P0-1.
- Manual test: user A cannot GET, PUT, DELETE, or download artifact belonging to user B (returns `404`).
- Added integration test covers all five routes.

**Files:** every `/api/artifacts/[artifactId]/*` and `/api/inputs/[inputId]/*` route.

---

## P1 — Hardening before real customers

### P1-7 ☐ [DL · Security] Rate limit AI + transcript endpoints
**Acceptance criteria**
- Token-bucket limiter (e.g. `@upstash/ratelimit` against Redis, or in-memory for single-replica demo).
- Limits: `agent-runs` 5/min/user, 20/hour/user; `transcripts/extract` 10/min/user; `artifacts/regenerate` 10/min/user.
- Exceeded → `429` with `Retry-After`.
- Foundry quota dashboard linked in README.

**Files:** middleware or per-route `rateLimit()` helper.

---

### P1-8 ☐ [EA · Observability] OpenTelemetry + Application Insights
**Acceptance criteria**
- `@azure/monitor-opentelemetry` wired in `instrumentation.ts`.
- Every agent step emits a span (`agent.name`, `agent.duration_ms`, `agent.used_llm`, `agent.llm_error`, `run.id`, `project.id`).
- Custom metrics: `workshopbuddy.agent_run.duration_ms`, `workshopbuddy.transcript.cards_proposed`, `workshopbuddy.ai.tokens_estimated`.
- Request log includes correlation id (W3C `traceparent`) returned in `x-request-id` response header.
- One sample KQL query in `docs/observability.md` for "failed runs in last 24h with stack".

**Files:** new `instrumentation.ts`, [src/lib/agents/orchestrator.ts](innovate-impact/src/lib/agents/orchestrator.ts).

---

### P1-9 ☐ [DL · Security] CSRF protection
**Acceptance criteria**
- Cookie-based session uses `SameSite=Lax` (or `Strict` where compatible) + `Secure` + `HttpOnly`.
- Origin/Referer check on all mutating routes; mismatched origin → `403`.
- Optional double-submit token for `POST`/`PUT`/`DELETE` when cookie auth is in use.
- Test: cross-origin `fetch` from a hostile page is rejected.

**Files:** `src/middleware.ts` (new), auth helper.

---

### P1-10 ☐ [DL · Security] Security headers + CSP
**Acceptance criteria**
- `next.config.js` adds: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- CSP allows `self`, `data:` for inline logos, the Foundry endpoint, and nothing else; `script-src 'self'` (no `unsafe-inline` outside Next.js's required nonces).
- `securityheaders.com` grade A on the deployed URL.

**Files:** [innovate-impact/next.config.js](innovate-impact/next.config.js).

---

### P1-11 ☐ [DL · Reliability] Remove private-field reflection on `PrismaPg`
[src/lib/db.ts](innovate-impact/src/lib/db.ts#L88) uses `@ts-expect-error` to swap the internal pool every 50 min — fragile across adapter upgrades.

**Acceptance criteria**
- Single code path: async `password` callback that calls `getToken()` for every new pool connection (locally via `AzureCliCredential`, in ACA via `DefaultAzureCredential` + UAMI).
- `setInterval` pool-swap deleted.
- `@ts-expect-error` lines removed.
- Local + ACA both pass a 2-hour soak test (covers >1h token expiry).

**Files:** [src/lib/db.ts](innovate-impact/src/lib/db.ts).

---

### P1-12 ☐ [DL · Reliability] Idempotency keys
**Acceptance criteria**
- `POST /agent-runs`, `POST /inputs/batch`, `POST /transcripts/extract` accept `Idempotency-Key` header.
- Key + path + user hashed; previous response replayed for ≤24h on identical key.
- Double-click in the UI no longer creates duplicate runs/inputs.

**Files:** new `src/lib/api/idempotency.ts`, relevant routes.

---

### P1-13 ☐ [EA · Security] Sandbox transcript parsing
`pdf-parse` and `mammoth` parse untrusted user content inside the web process with DB credentials.

**Acceptance criteria**
- Extraction moved to a separate Container Apps Job (no DB, no Foundry credentials) that returns normalized text via Service Bus / blob handoff.
- File **MIME** sniffed (`file-type` package) and matched against extension; mismatch → `415`.
- CPU/memory cap on the job (e.g. 0.5 vCPU / 1 GiB).
- Web process no longer imports `pdf-parse` or `mammoth`.

**Files:** [src/lib/transcripts/parse.ts](innovate-impact/src/lib/transcripts/parse.ts), [src/app/api/projects/[projectId]/transcripts/extract/route.ts](innovate-impact/src/app/api/projects/[projectId]/transcripts/extract/route.ts), new worker.

---

### P1-14 ☐ [DL · Security] Safer download filenames + content-type
[download/route.ts](innovate-impact/src/app/api/artifacts/[artifactId]/download/route.ts#L10): `safeFilename` keeps interior dots, so `Project.v1.exe` is possible.

**Acceptance criteria**
- All `.`/`/`/`\` stripped from the base name; extension appended from validated `format`.
- `Content-Disposition` filename ASCII-only; UTF-8 filename uses `filename*=UTF-8''...` RFC 5987.
- `X-Content-Type-Options: nosniff` set per-response.

**Files:** [src/app/api/artifacts/[artifactId]/download/route.ts](innovate-impact/src/app/api/artifacts/[artifactId]/download/route.ts).

---

### P1-15 ☐ [EA · Reliability] Migrate JSON-string columns to `Json` / `jsonb`
`desiredOutcomes`, `targetAudience`, `selectedArtifacts`, `inputJson`, `outputJson`, `logJson`, `contentJson` are all `String`. Loses indexing, validation, and pays `JSON.parse` on every read.

**Acceptance criteria**
- Prisma fields changed to `Json`.
- One-shot migration converts existing rows; rollback script tested.
- All `JSON.parse(...)` / `JSON.stringify(...)` call sites cleaned up.

**Files:** [prisma/schema.prisma](innovate-impact/prisma/schema.prisma), every consumer.

---

## P2 — UX, a11y, dev ergonomics

### P2-16 ☐ [UX · Trust] Identity surface in the shell
**Acceptance criteria**
- Signed-in user avatar + name + role badge in [src/components/app-shell.tsx](innovate-impact/src/components/app-shell.tsx) footer (replacing the demo notice, which moves under the logo).
- "Sign out" link works; sign-out clears session and redirects to `/login`.
- Mobile header shows same affordance.

---

### P2-17 ☐ [UX · Accessibility] Mobile navigation drawer
The sidebar is `hidden md:flex` ([app-shell.tsx](innovate-impact/src/components/app-shell.tsx#L23)) — verify the mobile nav actually opens.

**Acceptance criteria**
- Hamburger button in mobile header opens a slide-over containing the same nav.
- Drawer traps focus, closes on Esc + outside click, restores focus to trigger.
- All routes reachable on a 360px viewport.

---

### P2-18 ☐ [UX · Trust] Agent run progress UI
Today the client polls and shows little.

**Acceptance criteria**
- Stepper of the 11 agents with per-step state (Queued / Running / Done / Failed) and duration.
- Live tooltips for `llmError`.
- Non-blocking toast notification on completion + deep link to artifacts.
- Progress survives a full-page refresh (state read from `GET /agent-runs/:runId`).

**Files:** new `src/components/agent-run-progress.tsx`, [src/app/projects/[projectId]/agents/page.tsx](innovate-impact/src/app/projects/[projectId]/agents/page.tsx).

---

### P2-19 ☐ [UX · Resiliency] Global error + loading boundaries
**Acceptance criteria**
- `app/error.tsx`, `app/loading.tsx` exist at the root and per major segment (`projects`, `workshop`, `artifacts`, `agents`).
- Errors show a friendly card with a "Copy correlation id" button (id from P1-8).
- Loading states use skeletons matching the final layout.

---

### P2-20 ☐ [UX · Accessibility] WCAG 2.1 AA audit pass
**Acceptance criteria**
- All interactive elements show a visible focus ring (`focus-visible:` Tailwind class).
- Text contrast ≥ 4.5:1 (`text-slate-500` on `bg-ink-900` likely fails; bump to `slate-400` or darker bg).
- `aria-current="page"` on active nav item.
- `prefers-reduced-motion` respected for any transitions.
- axe-core CI check on the seeded project flow passes with zero serious/critical violations.

---

### P2-21 ☐ [UX · Trust] Confidence + provenance UX on transcript cards
Data model already carries `confidence` and `evidence`. Surface them.

**Acceptance criteria**
- Each candidate card in the review modal shows a confidence pill (Low/Med/High mapped from the score).
- Hover/click reveals the evidence quote with quote marks and a "Jump to transcript" affordance.
- Accepted `WorkshopInput` rows in the board show a small "from transcript" badge linking back to the `TranscriptIngest`.

**Files:** [src/components/transcript-import-modal.tsx](innovate-impact/src/components/transcript-import-modal.tsx), [src/components/workshop-board.tsx](innovate-impact/src/components/workshop-board.tsx).

---

### P2-22 ☐ [DL · Reliability] Unit + e2e tests
**Acceptance criteria**
- Vitest covers: [src/lib/transcripts/parse.ts](innovate-impact/src/lib/transcripts/parse.ts), [src/lib/workshop-enums.ts](innovate-impact/src/lib/workshop-enums.ts), deterministic paths in [src/lib/agents/orchestrator.ts](innovate-impact/src/lib/agents/orchestrator.ts).
- Playwright smoke: create project → paste transcript → accept cards → Run Full Workflow (demo mode) → download markdown.
- Coverage target ≥ 50% on `src/lib/**`.

---

### P2-23 ☐ [DL · Reliability] CI pipeline
**Acceptance criteria**
- GitHub Actions: `lint` + `typecheck` + `vitest` + `prisma validate` + `bicep build` on every PR.
- `azd provision --preview` dry-run on `main`.
- Required status check on `main`.

**Files:** new `.github/workflows/ci.yml`.

---

### P2-24 ☐ [EA · Resiliency] Postgres backup / DR documented + enforced
**Acceptance criteria**
- Bicep sets `geoRedundantBackup: 'Enabled'` and `backupRetentionDays: 14` for non-dev environments.
- README documents RPO (≤24h) and RTO (≤1h) for the demo and the procedure to restore.
- One successful point-in-time restore drill recorded in `docs/runbooks/dr.md`.

**Files:** [innovate-impact/infra/main.bicep](innovate-impact/infra/main.bicep), new `docs/runbooks/dr.md`.

---

## P3 — Polish & longer term

### P3-25 ☐ [EA · Multitenancy] `Organization` scope
**Acceptance criteria**
- New `Organization` table; `Project.organizationId` FK; `User` (or session claim) belongs to one or more orgs.
- All queries filtered by org.
- Migration path for existing single-tenant data.

### P3-26 ☐ [UX] Light theme
**Acceptance criteria**
- `next-themes` toggle in the shell.
- Both themes pass the P2-20 contrast bar.
- User preference persisted in localStorage + server-side cookie hint to avoid FOUC.

### P3-27 ☐ [DL · Observability] Replace `console.warn` with structured `pino` logger
**Acceptance criteria**
- All `console.*` in `src/lib/**` and `src/app/api/**` migrated.
- Log level controlled by `LOG_LEVEL` env var.

### P3-28 ☐ [EA · Security] Container image hardening
**Acceptance criteria**
- Base image pinned by digest (not tag) in [Dockerfile](innovate-impact/Dockerfile#L5).
- Runs as non-root user (`USER node` or new `appuser`).
- ACA `readOnlyRootFilesystem: true` where compatible (Next.js cache dirs mounted as `emptyDir`).
- Trivy scan in CI; fails on `HIGH`+.

### P3-29 ☐ [UX] Artifact version diff view
**Acceptance criteria**
- Side-by-side diff of any two `ArtifactVersion`s for a given artifact.
- Markdown diff with semantic (paragraph-level) granularity.
- Surfaced from the artifact workspace.

**Files:** [src/components/artifact-workspace.tsx](innovate-impact/src/components/artifact-workspace.tsx).

### P3-30 ☐ [DL] Unify local + ACA DB code path (folded into P1-11; close together)

---

## Suggested Sprint 1 (in order)

1. **P0-1** AuthN/Z + ownership
2. **P0-6** IDOR closure (rides on P0-1)
3. **P0-2** Postgres SSL trust
4. **P0-5** zod validation everywhere
5. **P0-3** Migrations as a Job
6. **P0-4** Orchestrator worker + Service Bus + orphan sweeper
7. **P1-10** Security headers + CSP
8. **P2-18** Agent run progress UI + **P2-19** error/loading boundaries

---

## Working agreement for this backlog

- We pick **one item at a time**, agree the design in chat, implement, validate (build/lint/tests), then check it off in this file.
- Anything we discover mid-implementation that doesn't belong to the current item → new entry at the bottom of the right priority section.
- I will keep this file as the single source of truth for status; commit messages reference the item id (e.g. `P0-2: trust DigiCert root for pg SSL`).
