# Coforma Studio Agent Operating Guide

Customer/CAB data and side-effect rules:
- Treat tenants, users, memberships, Customer Advisory Board sessions, comments, votes, feedback, recordings/transcripts, OAuth identities, integration tokens, Stripe billing data, R2 exports/uploads, webhook payloads, analytics events, and generated reports as sensitive customer/business data.
- Treat DB migrations/seeds/resets, Prisma Studio, local service stacks, RLS test fixtures with tenant data, exports/imports, webhook delivery, OAuth/integration sync, billing flows, SDK/package publishing, and GitOps deploys as side-effectful. Run them only after explicit operator request and the matching local guard environment variable.
- Placeholder-only secrets belong in examples and docs: NextAuth, OAuth/OIDC, Stripe, R2/Cloudflare, Meilisearch, Resend, Slack, Zoom, Jira, Asana, ClickUp, Sentry/PostHog, npm/GitHub, database, and Redis credentials.
- Local guard variables: `LOCAL_SERVICES=yes` for service stacks/dev servers, `LOCAL_DB=yes` for migrations/seeds/Prisma Studio, `LOCAL_DESTRUCTIVE=yes` for cleanup/reset flows, `LOCAL_CUSTOMER_DATA_OPS=yes` for tenant/customer data, exports, webhooks, integrations, billing, or package publishing, and `LOCAL_PRODUCTION_OPS=yes` for deploy or live production operations.

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.


<!-- MADFAM-AGENTS-CANONICAL v1 -->

This is the canonical instruction file for Claude, Codex, and any other LLM
agent working in this repository. `CLAUDE.md` is kept only as a compatibility
redirect and should not become the source of truth again.

## Required operating doctrine

- Read this file before making repo changes.
- Prefer existing repo conventions, scripts, and docs over introducing new
  patterns.
- Preserve user work and never revert unrelated changes.
- Treat production operations as Enclii-first: use Enclii web, API, or CLI for
  provisioning, deployment, observability, domains, secrets, provider
  operations, scaling, rollback, and remediation.
- Use direct `kubectl`, `helm`, SSH, provider CLIs/APIs, `docker exec`, or
  direct container access only for platform bootstrap or documented break-glass
  emergencies when Enclii is unavailable or lacks an implemented adapter.
- Record any missing Enclii adapter gap instead of normalizing raw production
  access in docs or runbooks.

## Repo entrypoints

- `README.md`
- `ECOSYSTEM.md`
- `docs/`
- `infra/`
- `.github/workflows/`

## LLM context files

- `llms.txt` is the compact context index.
- `llms-full.txt` is the durable full-context map and operating contract.
- `AGENTS.md` is canonical for agent instructions.
- `CLAUDE.md` redirects here for Claude compatibility.

## Maintenance

Regenerate or repair these files with
`internal-devops/scripts/sync-agent-docs.py` from the labspace ecosystem.

## Current state (verified 2026-10-02)

This section is current. The imported legacy guidance below is kept for
context; where they disagree, this section, `README.md` and `PROJECT_STATUS.md`
win.

### Stack

- `packages/web`: Next.js 15.5.27 (App Router), tRPC 10.45.4.
- `packages/api`: NestJS + Prisma (not deployed; see Deploy).
- `packages/types`, `packages/ui`, `packages/client`.
- #144 (2026-10-01) took `pnpm audit --prod` from 1 critical / 51 high to 0
  critical / 2 high. Both remaining highs are `postcss` 8.4.31, which `next`
  pins exactly. Range-scoped overrides cover `fast-xml-parser`, `multer`,
  `path-to-regexp`, `lodash`, `js-yaml` and `rollup`.

### Deploy

- `.github/workflows/build-deploy.yml` is an in-repo pipeline (it does not
  call the Enclii reusable workflow). It builds only the **web** image from the
  root `Dockerfile`, pushes `ghcr.io/madfam-org/coforma-studio/web:<sha>`,
  signs it with cosign (three attempts), and resolves the digest from the
  registry. It then commits `deploy(web): pin digest <short> [skip ci]` to
  `infra/k8s/production/kustomization.yaml`, and Argo CD reconciles.
- It triggers on pushes to `main`, except changes limited to `**.md` and
  `docs/**`. `llms.txt` and `llms-full.txt` are not `**.md`, so changing them
  rebuilds web. `workflow_dispatch` needs `deploy_ack=production` and a reason
  of at least 12 characters.
- The concurrency group `coforma-production-kustomization` does not cancel
  in-progress runs.
- Only `web-deployment.yaml` is in the kustomization `resources:`. The
  `api-deployment.yaml` and `admin-deployment.yaml` manifests are not
  deployed. `docs/deploy-readiness.md` (2026-07-07) explains why.
- Runners: the deploy job uses ARC (`madfam-runners-blue`) when
  `ARC_BOOTSTRAP_COMPLETE` is `true`, otherwise `ubuntu-24.04`. CI jobs are
  pinned to `ubuntu-24.04` (#145), ahead of GitHub moving `ubuntu-latest` to
  Ubuntu 26 on 2026-10-19. Do not reintroduce `ubuntu-latest`.

### Tests and CI gates

`ci.yml`:

- Blocking:
  - NetworkPolicy port lint;
  - ESLint for every package except `@coforma/web`;
  - `pnpm typecheck`;
  - `pnpm build`;
  - `pnpm test` (turbo, vitest per package) after `pnpm db:migrate:test`
    against a Postgres service container;
  - a Trivy filesystem scan with SARIF upload.
- Advisory (`continue-on-error`):
  - `@coforma/web` ESLint, tracked in #113;
  - `pnpm format:check`, tracked in #114.

Known gaps:

- The root `tests/api/*.test.ts` files (health, boards, feedback) call a
  running server at `API_URL`. Nothing in CI runs them: the root `test` script
  is turbo, and the root is not a workspace package.
- `packages/web` Playwright (`test:e2e`) is not run in CI.
- No skipped (`.skip`/`.only`) tests, and no known flaky tests. CI on `main`
  has been green since 2026-08-14.

### Security invariant: Next image optimizer off

`packages/web/next.config.js` sets `images.unoptimized: true` with
`remotePatterns: []`, so `/_next/image` answers 404 (GHSA-2xp9-vwfh-vxw4
defence in depth; `next` 15.5.27 already carries the fix). Nothing imports
`next/image`; avatars are plain `<img>` tags. The middleware matcher skips
`/_next/image`, so an enabled optimizer would be reachable without a session.
`packages/web/src/__tests__/next-config-images.test.ts` (vitest, blocking
`pnpm test`) checks the flag, the exact empty allow-list with no `domains`,
and that no `src/` file imports `next/image`. Re-enabling the optimizer or
adding a remote origin means changing the config, the test and this section
together, with exact origins only (never a `**.r2.dev`-style wildcard).

### Session token

The `janua_session` cookie is Coforma's own HS256 session JWT, not a Janua
token: the OIDC callback exchanges the code, reads Janua's userinfo
server-side, then mints the cookie with the Coforma-held `JANUA_JWT_SECRET`
(the name is historical). Janua tokens are never verified locally, so Janua's
JWKS/RS256 contract does not apply. Every mint and verify goes through
`packages/web/src/lib/session-token.ts` (#148): HS256 only, `exp` and `sub`
required, an unset or empty secret fails closed, and a secret shorter than 32
bytes logs a warning. `packages/web/src/lib/__tests__/session-token.test.ts`
covers it. These routes live under `src/app`, which is not in the shipped
build today (see `docs/deploy-readiness.md`, F1).

### Pending work (as of 2026-10-02)

This is the single pending-work list for the repository. `PROJECT_STATUS.md`,
`README.md`, `llms.txt` and `llms-full.txt` point here. Priorities: **P0**
blocks production use, **P1** next, **P2** planned, **P3** cleanup.

| Item | Why it matters | Priority | Kind | Tracking |
| ---- | -------------- | -------- | ---- | -------- |
| **Ship the product `src/app` or bless the web shell.** Next.js builds root `app/` (`/`, `/_not-found`, `/api/health`) and silently excludes `packages/web/src/app` (auth pages, `[tenant]` pages, `/api/v1/*` handlers). Before `src/app` ships: complete the auth hardening checklist (tracked privately) and set `JANUA_JWT_SECRET` to at least 32 bytes (`openssl rand -hex 32`). | Today production serves only a shell; none of the product, including Janua sign-in, is live. | P1 | Owner decision, then engineering work | `docs/deploy-readiness.md`, F1 |
| **Deploy the API.** `@coforma/api` now typechecks and builds in CI, but there is no api image job, and `api-deployment.yaml` is not in the kustomization `resources:`. The billing-dependency question (F2 cluster 1: provide `@madfam/billing`/`@janua/client` or remove the module) comes first. | Without it the PhyndCRM and Tulana webhook paths have no running receiver. | P2 | Owner decision (billing deps), then engineering work | `docs/deploy-readiness.md`, F2 and "Recommended order of work" |
| **Integrate Dhanam billing** and drop the unused `stripe*` Prisma columns. | Dhanam is the mandated billing platform; no payment processor is integrated. | P2 | Engineering work | — |
| **Enclii runtime/network onboarding.** `enclii.yaml` is status-only. | Deploys use the in-repo pipeline instead of the shared Enclii path. | P2 | Engineering work | — |
| **ESLint and Prettier are red.** `@coforma/web` ESLint (579 typed-lint errors) and `pnpm format:check` (116 files) run as `continue-on-error`. | Lint and format regressions in those areas do not fail CI. | P2 | Engineering work | #113, #114 |
| **Tests that never run in CI.** The root `tests/api/*.test.ts` live-server tests (health, boards, feedback) and the `packages/web` Playwright suite (`test:e2e`). | They can rot unnoticed; the shipped web shell has no end-to-end check. | P2 | Engineering work | "Tests and CI gates" above |
| **Seed-data hygiene.** `packages/api/prisma/seeds/madfam-internal-tenant.ts` hardcodes a named person as the owner user. | A public repo should seed placeholders or read the owner identity from the environment. | P2 | Owner decision (which identity to seed), then engineering work | — |
| **Retire the Vercel/Railway runbooks** in `docs/deployment.md`. | They describe a deploy path the repo does not use. | P3 | Engineering work | — |
| **CAB product features** (recruitment CRM, engagement hub, roadmap linkage, incentives, analytics). | Most product features are not built; see the phases in `README.md`, "Roadmap". | P3 | Owner decision (sequencing) | `README.md`, "Roadmap" |

### Related repositories / contracts

| Contract                                  | Coforma side                                                                                   | Other side                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Janua identity                            | `packages/web/src/lib/auth.ts`                                                                 | [janua `docs/guides/ECOSYSTEM_INTEGRATION.md`](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md)                 |
| PhyndCRM events out (`x-madfam-signature`) | `packages/web/src/lib/phyndcrm-relay.ts`, `packages/api/src/integrations/phyndcrm/phyndcrm-relay.service.ts` | [phynd-crm `README.md`](https://github.com/madfam-org/phynd-crm/blob/main/README.md)                                                                 |
| PhyndCRM webhooks in                      | `packages/api/src/integrations/phyndcrm/phyndcrm-webhook.service.ts`                           | [phynd-crm `docs/ENGAGEMENT_EVENT_TAXONOMY.md`](https://github.com/madfam-org/phynd-crm/blob/main/docs/ENGAGEMENT_EVENT_TAXONOMY.md)               |
| Tulana PMF events                         | `packages/api/src/integrations/tulana/cab-event-webhook.service.ts`                            | Tulana `/v1/pmf/coforma-event` (the Tulana repository is not public)                                                                               |

Other MADFAM services that emit to PhyndCRM copy the byte-identical wire format
from `packages/web/src/lib/phyndcrm-relay.ts`.

---

## Legacy CLAUDE.md guidance imported on 2026-05-13

<!-- BEGIN LEGACY_CLAUDE_IMPORT -->

# Coforma Studio - CLAUDE.md

> **Customer Advisory Boards as a Growth Engine**

## Overview

**Status**: 🟡 Foundation Phase (40% Complete)  
**Purpose**: Multi-tenant SaaS for creating and managing Customer Advisory Boards (CABs)  
**License**: Proprietary (Innovaciones MADFAM)  
**Domain**: [coforma.studio](https://coforma.studio)

Coforma Studio transforms Customer Advisory Boards into **growth engines** that accelerate product-market fit, strengthen loyalty, and reduce customer acquisition costs. Built with a LATAM-first ethos for global scalability.

**Category**: Advisory-as-a-Service (AaaS)

---

## Quick Start

```bash
cd coforma-studio

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Start infrastructure
docker compose up -d

# Run database migrations
pnpm prisma migrate dev

# Start development
pnpm dev
```

---

## Project Structure

```
coforma-studio/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/              # App Router pages
│   │   ├── components/       # React components
│   │   └── lib/              # Utilities
│   └── api/                  # NestJS backend (if separate)
├── packages/
│   ├── ui/                   # Shared UI components
│   └── config/               # Shared configuration
├── prisma/
│   └── schema.prisma         # Database schema
├── docker-compose.yml
└── .env.example
```

---

## Development Commands

### Monorepo
```bash
pnpm install          # Install all dependencies
pnpm dev              # Run all apps
pnpm build            # Build for production
pnpm lint             # Lint all packages
pnpm test             # Run tests
```

### Database
```bash
pnpm prisma generate        # Generate Prisma client
pnpm prisma migrate dev     # Create/apply migration
pnpm prisma studio          # Open database GUI
pnpm prisma db seed         # Seed data
```

### Frontend
```bash
cd apps/web
pnpm dev              # Start dev server (port 5100)
pnpm build            # Production build
pnpm test             # Run tests
```

---

## Port Allocation

| Service | Port | Description |
|---------|------|-------------|
| Web | 5100 | Next.js frontend |
| API | 5101 | Backend API |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache/Queue |
| Meilisearch | 7700 | Search |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Browser                     │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Next.js (Vercel)                        │
│         React + TailwindCSS + shadcn/ui             │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              NestJS API (Railway)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   CAB   │ │ Members │ │Sessions │ │Analytics│   │
│  │ Module  │ │ Module  │ │ Module  │ │ Module  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│     PostgreSQL (RLS) │ Redis │ Meilisearch          │
│        Railway       │Railway│    Railway           │
└─────────────────────────────────────────────────────┘
```

---

## Core Features

### Recruitment & CRM
- CAB candidate pipeline management
- Contract and NDA handling
- Onboarding workflows
- Member profiles and history

### Engagement Hub
- Session scheduling and calendar integration
- Agenda and minutes management
- Structured feedback collection
- Discussion forums

### Roadmap Linkage
- Connect feedback to product roadmap
- Jira/Asana/ClickUp integration
- Feature voting and prioritization
- Impact tracking

### Incentives & Recognition
- Discount programs
- Referral tracking
- Achievement badges
- Member spotlights

### Analytics & ROI
- Engagement dashboards
- Revenue influence tracking
- Executive-ready reports
- NPS and satisfaction metrics

---

## Integrations

| Category | Integrations |
|----------|-------------|
| **Video** | Zoom, Google Meet, Teams |
| **Communication** | Slack, Email |
| **Project Management** | Jira, Asana, ClickUp |
| **CRM** | HubSpot, Salesforce |
| **Payments** | Dhanam (mandated; not integrated yet). Stripe was the original plan. |
| **Calendar** | Google Calendar, Outlook |

---

## Multi-Tenancy

Coforma Studio uses **Row-Level Security (RLS)** for tenant isolation:

```sql
-- All tables include tenant_id
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://coforma:coforma@localhost:5432/coforma

# Redis
REDIS_URL=redis://localhost:6379

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=your-master-key

# Auth (NextAuth)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:5100

# Integrations
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
SLACK_BOT_TOKEN=...
STRIPE_SECRET_KEY=...
```

---

## Pricing Tiers

| Tier | Price | Members | Features |
|------|-------|---------|----------|
| **Starter** | $500-1k/mo | 25 | Basic CRM, event management |
| **Growth** | $2-3k/mo | 100 | Integrations, advanced analytics |
| **Enterprise** | $5k+/mo | Unlimited | White-label, API, custom SLAs |

**Add-ons**: Facilitation training, managed services, insights packages

---

## Roadmap

### Phase 1: Foundation (0-6 months) 🟡 Current
- [ ] Internal pilot with MADFAM CABs
- [ ] MVP: Recruitment, engagement, dashboards
- [ ] Basic analytics and reporting

### Phase 2: SaaS Launch (6-12 months)
- [ ] Public SaaS MVP
- [ ] 1-2 pilot external clients
- [ ] Stripe billing integration

### Phase 3: Productization (12-24 months)
- [ ] White-labeling capabilities
- [ ] Full integration suite
- [ ] Advanced analytics

### Phase 4: Scale (24+ months)
- [ ] AI-assisted facilitation
- [ ] Facilitator marketplace
- [ ] Enterprise/government adoption

---

## API Endpoints (Preview)

```
# CABs
GET    /api/v1/cabs
POST   /api/v1/cabs
GET    /api/v1/cabs/:id

# Members
GET    /api/v1/cabs/:id/members
POST   /api/v1/cabs/:id/members
PATCH  /api/v1/members/:id

# Sessions
GET    /api/v1/cabs/:id/sessions
POST   /api/v1/cabs/:id/sessions
POST   /api/v1/sessions/:id/feedback

# Analytics
GET    /api/v1/cabs/:id/analytics
GET    /api/v1/cabs/:id/reports
```

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

---

## Deployment

### Development
```bash
docker compose up -d
pnpm dev
```

### Production
Superseded. Vercel and Railway are not used. The web image ships through
`build-deploy.yml` → GHCR → digest pin → Argo CD, and the API is not deployed.
See "Current state" above and `docs/deployment.md`.

---

## Related Documentation

- **PROJECT_STATUS.md** - Current phase details
- **docs/architecture/SOFTWARE_SPEC.md** and **docs/architecture/TECH_STACK.md** - Technical architecture
- **docs/api-specification.md** - API reference
- **docs/deploy-readiness.md** - What ships and what does not

---

## Internal MADFAM Dogfooding

Coforma Studio's first tenant is **MADFAM itself**. Per **RFC 0013 Wave PMF-3** and
**ADR-003** (`internal-devops/decisions/adr-003-tulana-coforma-integration.md`), we
dogfood Coforma to run our own CABs while the platform matures from 40% → 80%.

### Tenant of record

| Field | Value |
|---|---|
| Tenant slug | `madfam-internal` |
| Tenant name | MADFAM Internal — PMF Measurement |
| Visibility | Private (no public listing) |
| Owner | MADFAM operator account (TenantRole.ADMIN; set in the seed) |
| Seed | `packages/api/prisma/seeds/madfam-internal-tenant.ts` |

### Active CABs

- **`tezca-spring-2026`** — Tezca CAB, Spring 2026 cohort, 5–15 members.
  Quarterly Sean Ellis PMF interviews with roadmap-linkage to Tezca Linear/Jira.
  Outreach playbook: `docs/pmf/tezca-cab-candidate-identification.md`.

### Seeded templates

- **Sean Ellis PMF survey** (`sean-ellis-pmf-v1`) — structured 30-min session with
  5 questions (Q2/Q3 conditional on Q1 = "very disappointed"). Template lives in
  `packages/api/prisma/seeds/templates/sean-ellis-pmf-template.ts` and is stamped
  onto seeded sessions' `agendaItems` JSON column.

### Outbound webhook to Tulana

When a CAB session is marked `COMPLETED`, Coforma fires a signed (HMAC-SHA256)
webhook to Tulana's `/v1/pmf/coforma-event` endpoint. The webhook is fire-and-forget
— delivery failures are logged but never roll back the session-completion transaction.

- Service: `packages/api/src/integrations/tulana/cab-event-webhook.service.ts`
- Module: `packages/api/src/integrations/tulana/tulana.module.ts`
- Required env: `TULANA_PMF_WEBHOOK_SECRET` (must match Tulana side
  `COFORMA_WEBHOOK_SECRET`), `TULANA_API_URL` (defaults to
  `https://tulana-api.madfam.io`).

Sentiment scoring is v0.1 (Q1 weight + neutral text contribution). Real NLP
classification of free-text answers is deferred to v0.2.

### References

- RFC 0013 Wave PMF-3 — PMF Measurement via Coforma + Tulana
- ADR-003 — `internal-devops/decisions/adr-003-tulana-coforma-integration.md`

---

*Coforma Studio - Advisory-as-a-Service | CABs as Growth Engines*

<!-- END LEGACY_CLAUDE_IMPORT -->
