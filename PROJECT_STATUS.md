# Coforma Studio — Project Status

**Last Updated:** 2026-07-04 (deploy, CI and dependency facts re-verified 2026-10-01; see `AGENTS.md` "Current state")
**Current Phase:** Foundation
**Production Ready:** No

This file is the authoritative, evidence-based status of the repository. Every
claim below is verifiable against the tree at the stated date. The previous
status report (2025-11-19) is preserved at
[docs/business/PROJECT_STATUS.md](./docs/business/PROJECT_STATUS.md).

---

## Quick Status (verified 2026-07-04)

| Metric | Status |
|--------|--------|
| **Phase** | Foundation — core scaffolding in place, most product features not built |
| **Codebase size** | 229 tracked files; ~127 TypeScript/TSX source files under `packages/` |
| **Tests** | 12 test/spec files (API specs, RLS tenant-isolation, web route tests, smoke tests) |
| **Auth** | Janua OIDC implemented (`packages/web/src/lib/auth.ts`); NextAuth reduced to a deprecated redirect stub |
| **Billing** | `@madfam/billing` NestJS module wired via Janua client; no payment processor integrated (unused `stripe*` Prisma columns remain) |
| **Deploy** | GitHub Actions (`build-deploy.yml`) → GHCR **web** image (cosign-signed) → digest pin in `infra/k8s/production/kustomization.yaml` → Argo CD. Only `web-deployment.yaml` is in the kustomization; api and admin manifests exist but are not deployed |
| **Enclii** | `enclii.yaml` is **status-only** (feeds status.madfam.io); runtime/network onboarding onto the Enclii pipeline is pending |
| **Production Ready** | No — features incomplete, foundation phase |

---

## What Verifiably Exists

- **Monorepo:** Turborepo + pnpm workspaces: `packages/web` (Next.js 15),
  `packages/api` (NestJS + Prisma), `packages/types`, `packages/ui`.
- **Database:** PostgreSQL schema with Row-Level Security migrations for
  tenant isolation (`packages/api/prisma/`).
- **Auth:** Janua OIDC login with a Coforma-minted HS256 session cookie
  (`janua_session`, `packages/web/src/lib/session-token.ts`), signin/signup/
  signout pages and callback route. These live under `src/app`, which is not
  in the shipped build yet (`docs/deploy-readiness.md`, F1).
- **Billing scaffolding:** subscription/tier/feature/usage guards from
  `@madfam/billing/nestjs`, configured against `auth.madfam.io`.
- **Integrations code:** PhyndCRM relay/webhook services, Tulana CAB event
  webhook.
- **Infra:** Kubernetes production manifests (deployments/services for web,
  api, admin; network policies; kustomization with pinned image digests),
  Argo CD config, CI (`ci.yml`) and the build/deploy workflow
  (`build-deploy.yml` deploys web on every non-docs push to `main`; a manual
  `workflow_dispatch` requires a production acknowledgement and reason).
- **Local dev:** `docker-compose.yml` provides PostgreSQL 15, Redis 7,
  Meilisearch v1.5.

## What Does Not Exist Yet (despite older docs)

- **No Vercel/Railway deployment.** `docs/deployment.md` still documents the
  old Vercel/Railway runbooks; it is historical. The repo's own manifests and
  workflows deploy to Kubernetes.
- **No Stripe integration.** Only placeholder columns in the Prisma schema.
  Dhanam is the mandated MADFAM billing platform; integration is roadmap.
- **No full Enclii onboarding.** `enclii.yaml` intentionally contains only the
  status-page declaration.
- **Most product features** (recruitment CRM flows, engagement hub, roadmap
  linkage, incentives, analytics dashboards) are not implemented.

## Next Steps

The single pending-work list, with priorities and owner-decision vs
engineering labels, is in [`AGENTS.md`, "Pending work"](./AGENTS.md#pending-work-as-of-2026-10-02).
The first item is the owner decision on shipping the product `src/app`
(`docs/deploy-readiness.md`, F1).
