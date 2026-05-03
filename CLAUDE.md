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
| **Payments** | Stripe |
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
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway PostgreSQL
- **Search**: Railway Meilisearch
- **CDN**: Cloudflare

---

## Related Documentation

- **PROJECT_STATUS.md** - Current phase details
- **ARCHITECTURE.md** - Technical architecture
- **INTEGRATIONS.md** - Integration guides
- **API.md** - API reference

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
| Owner | `aldoruizluna@madfam.io` (TenantRole.ADMIN) |
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
