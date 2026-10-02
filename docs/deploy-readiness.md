# Deploy Readiness Assessment — 2026-07-07

> **Status as of 2026-10-01.** The api compile blocker (F2) is resolved: #112
> took `@coforma/api` from 57 TypeScript errors to 0, and `pnpm typecheck` gates
> CI. The rest still holds. `build-deploy.yml` builds only the web image, and
> only `web-deployment.yaml` is in the kustomization `resources:`. The api still
> has no image job and no kustomization entry. Current pipeline facts are in
> `AGENTS.md` ("Current state") and [deployment.md](./deployment.md).

**Branch:** `claude/deploy-readiness` · **Base:** `main` @ `7da3b4a`
**Verdict:** `web` shell is deployable today (pipeline exists and the image builds);
the **product is not** — the built web artifact serves only a landing page +
health check, and the **api package (which carries the ADR-003 Tulana PMF
webhook) does not compile**.

All findings below were verified by running the repo's own tooling in a clean
clone (`pnpm install --frozen-lockfile` → 36s, success, including
`prisma generate`). Node 22, pnpm 9.15.0.

---

## Per-component verdicts

| Component | Builds? | Servable artifact? | Deployed by pipeline? | Verdict |
|---|---|---|---|---|
| `@coforma/web` | Yes (`next build`, standalone output) | Yes — but only root `app/` shell: routes `/`, `/_not-found`, `/api/health` | Yes (`build-deploy.yml` → GHCR → cosign → digest pin → Argo CD) | **Deployable shell; product routes excluded (see F1)** |
| `@coforma/api` | **No — 53 TypeScript errors** | No `dist/` | No image build step; `api-deployment.yaml` exists but is **not** in `kustomization.yaml resources:` | **Blocked (see F2)** |
| `@coforma/types`, `@coforma/ui`, `@coforma/client` | Yes | n/a (libraries) | n/a | OK |
| admin | No source exists | No | `admin-deployment.yaml` exists but not in kustomization | Manifest is aspirational only |

## F1 — The built web artifact does not contain the product (owner decision needed)

`packages/web` has **both** `app/` and `src/app/`. Next.js uses root `app/`
when both exist. The production build output is exactly:

```
Route (app)      /        /_not-found        /api/health
```

Everything under `packages/web/src/app/` — signin/signup/callback auth pages,
`[tenant]/…` product pages, `/api/v1/cabs|memberships|webhooks/phyndcrm`
route handlers — is **silently excluded from the shipped image**. Git history
is a single squashed commit, so intent can't be traced. Either the root
`app/` shell is a deliberate placeholder (then PROJECT_STATUS.md's "Auth:
implemented" claim needs a caveat that it is not deployed), or this is
accidental shadowing (then removing/merging root `app/` is a product change
that needs testing — `src/app` routes hit Prisma/Janua at runtime and need
real env). Not "fixed" here because it changes served behavior.

Note also `packages/web/next.config.js` sets `typescript.ignoreBuildErrors:
true`, so the web build passing is not evidence of type safety.

## F2 — `@coforma/api` does not compile (53 errors; blocks ADR-003 webhook)

`pnpm --filter=@coforma/api build` fails with 53 errors in 4 clusters:

1. **Unresolvable private deps (5 errors, hard blocker):**
   `src/modules/billing/*` imports `@madfam/billing`, `@madfam/billing/nestjs`
   and `@janua/client`. These are **not in `packages/api/package.json` and not
   in `pnpm-lock.yaml` at all**, so `pnpm install --frozen-lockfile` can never
   provide them — this fails in CI too, not just locally (npm.madfam.io
   returns 401 without `NPM_MADFAM_TOKEN`). `BillingModule` is imported by
   `app.module.ts`, so even suppressing TS errors would crash at runtime
   import. **Owner decision:** publish/add the packages + lockfile entry, or
   remove/stub the billing module.
2. `src/main.ts` imports `@sentry/node`, which is not a declared dependency
   of the api package (1 error; trivial once (1) is decided).
3. `src/trpc/trpc.router.ts` — 38 × TS2729 ("Property 'trpc' is used before
   its initialization"): class-field initializers reference the constructor-
   injected `TrpcService`. Mechanical fix (move router construction into the
   constructor), but pointless until (1) unblocks the build.
4. 9 assorted strict-mode/schema-drift errors, incl.
   `cab-member.service.ts:330` referencing Prisma field `discountPlanId`
   that does not exist on `CABMembershipUpdateInput` (schema drift), JSON
   null-handling in `session.service.ts`, and one `undefined` narrowing in
   `integrations/tulana/cab-event-webhook.service.ts:132` — yes, the ADR-003
   webhook file itself has a compile error.

Consequence for ADR-003: the Coforma→Tulana `cab_session_completed` webhook
(`packages/api/src/integrations/tulana/cab-event-webhook.service.ts`) cannot
ship until the api compiles, gets an image build + kustomization entry, and
`TULANA_PMF_WEBHOOK_SECRET` is provisioned to match Tulana's
`COFORMA_WEBHOOK_SECRET`.

## Verification results (2026-07-07, this branch)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS (36s) |
| `pnpm build` (root, turbo) | **FAIL** — `@coforma/api` 53 TS errors; types/ui/client pass; web task blocked by dep ordering |
| `pnpm --filter=@coforma/web build` (what the Dockerfile runs) | PASS — standalone output at `packages/web/.next/standalone/packages/web/server.js`, matches Dockerfile `CMD` |
| `docker build` | Not runnable here (no docker daemon); every Dockerfile step verified locally instead |
| `pnpm --filter=@coforma/web test` | PASS — 4 files, 35 tests |
| `pnpm --filter=@coforma/api test:unit` | PASS — 2 files, 18 tests |
| `pnpm --filter=@coforma/api test` | Not run — 5 files require a test `DATABASE_URL` (DB-backed RLS fixtures; guarded per AGENTS.md) |
| `pnpm test` (root) | FAIL for types/ui — they have **no test files** and fall back to the root `vitest.config.ts`, which imports `vitest` (not installed at root). Root `tests/api/*.test.ts` are orphaned (no runner wired) |
| `pnpm lint` | Runner was broken repo-wide (`@eslint/js` missing at root — **fixed on this branch**). After fix: types/ui PASS; api 201 errors / 32 warnings; web fails with pre-existing type-aware lint errors |
| `python3 scripts/check-networkpolicy-ports.py infra/k8s/` | PASS (6 policies, 3 workloads, 0 failures) |

## Gap analysis vs canonical deploy pattern (tulana `deploy-api.yml` / dhanam)

Already canonical before this branch: GHCR push, cosign keyless signing,
kustomize digest pin, Argo CD reconcile, manual `deploy_ack` gate,
`concurrency` group without cancel-in-progress, NetworkPolicy lint,
health probes + securityContext in manifests.

Closed on this branch (`.github/workflows/build-deploy.yml`):

- sigstore endpoint preflight (names runner-egress failures)
- explicit OIDC identity-token mint (audience `sigstore`) instead of
  ambient `COSIGN_EXPERIMENTAL` fetch
- manifest digest resolved via `docker buildx imagetools inspect`
  (multi-arch safe) instead of trusting `build-push-action` output
- `provenance: false` / `sbom: false` on build-push (GHCR 403 class)
- atomic commit-with-retry loop for the digest pin (race-safe against
  concurrent sessions)
- `infra/k8s/production/_secrets-template.yaml` documenting every env key
  (names only), canonical tulana pattern
- root `@eslint/js` devDependency so `pnpm lint` runs at all (the flat
  config crashed with `ERR_MODULE_NOT_FOUND` for every package before);
  paired with explicit `eslint.ignoreDuringBuilds: true` in
  `packages/web/next.config.js` — `next build` was already skipping lint
  (config crash), this keeps lint in the CI lint job without newly gating
  the image build on 200+ pre-existing lint errors

Remaining gaps (deliberately **not** scaffolded — no servable api artifact):

- api image build/sign/pin job + `api-deployment.yaml` into kustomization —
  blocked on F2
- `enclii.yaml` runtime/network onboarding (currently status-only; requires
  platform-side onboarding = production op, owner-driven)
- HPA/PDB (optional per pattern; add when there's real traffic)
- CI `test` job runs root `pnpm test` + `pnpm db:deploy` against a service
  Postgres — currently red for the reasons above; CI `build` job is also red
  (root `pnpm build` includes api)

## Env/secret NAMES required (values live in Enclii/K8s Secret, never in git)

See `infra/k8s/production/_secrets-template.yaml` for the authoritative,
commented list. Summary:

- **Runtime (web shell today):** none strictly required (landing + health
  check render env-free); Janua/PhyndCRM/Prisma keys become required the
  moment `src/app` routes ship.
- **Runtime (web product / api):** `DATABASE_URL`, `REDIS_URL`,
  `JANUA_ISSUER_URL`, `JANUA_CLIENT_ID`, `JANUA_CLIENT_SECRET`,
  `JANUA_JWT_SECRET`, `NEXT_PUBLIC_JANUA_ISSUER_URL`,
  `NEXT_PUBLIC_JANUA_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `PHYNDCRM_INBOUND_SECRET`,
  `PHYNDCRM_OUTBOUND_SECRET`, `PHYNDCRM_OUTBOUND_URL`,
  `PHYNDCRM_OUTBOUND_TIMEOUT_MS`, `PORT`, `CORS_ALLOWED_ORIGINS`,
  `SENTRY_DSN`, `JANUA_API_URL`, `JANUA_API_KEY`, `TULANA_API_URL`,
  **`TULANA_PMF_WEBHOOK_SECRET`** (must match Tulana's
  `COFORMA_WEBHOOK_SECRET`; ADR-003).
- **CI (GitHub Actions):** `MADFAM_BOT_PAT` (GHCR login + GitOps push),
  `NPM_MADFAM_TOKEN` (private registry in ci.yml), `DOCKER_USERNAME` /
  `DOCKER_TOKEN` and `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` (rate-limit
  logins, optional), ambient `GITHUB_TOKEN` + `id-token: write` (cosign OIDC).
  K8s side: `ghcr-credentials` imagePullSecret in the `coforma-studio`
  namespace.

## Recommended order of work

1. Owner decides F1 (ship the product `src/app` or bless the shell) and F2
   cluster 1 (billing deps: provide `@madfam/billing`/`@janua/client` or
   remove the module).
2. Fix remaining api TS errors (mechanical; ~1 day), add api Dockerfile
   target + image job mirroring the web job, add `api-deployment.yaml` +
   `api-service.yaml` to kustomization.
3. Provision `coforma-studio-secrets` via Enclii from the template; register
   `TULANA_PMF_WEBHOOK_SECRET` ↔ Tulana `COFORMA_WEBHOOK_SECRET` pair.
4. Enclii runtime/network onboarding (replace status-only `enclii.yaml`).
5. Un-red CI: root build/test jobs currently cannot pass by construction.
