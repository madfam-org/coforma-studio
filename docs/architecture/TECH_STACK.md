# Technology Stack

**Coforma Studio** — Architecture as a Service for Customer Advisory Boards

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Frontend Technologies](#frontend-technologies)
3. [Backend Technologies](#backend-technologies)
4. [Data Layer](#data-layer)
5. [Infrastructure & Deployment](#infrastructure--deployment)
6. [Third-Party Integrations](#third-party-integrations)
7. [Developer Experience](#developer-experience)
8. [Security & Compliance](#security--compliance)
9. [Monitoring & Operations](#monitoring--operations)
10. [Technology Decision Rationale](#technology-decision-rationale)

---

## Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Vercel)                                           │
│ Next.js 14+ (App Router) + React 18+ + TypeScript          │
│ Tailwind CSS + shadcn/ui + Radix UI                        │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTPS/TLS 1.3
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Railway)                                           │
│ NestJS + tRPC + NextAuth.js                                 │
│ Node.js v20+ (LTS) + TypeScript                             │
│ BullMQ (Background Jobs)                                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ DATA LAYER (Railway)                                        │
│ PostgreSQL 15+ (RLS-enforced multi-tenancy)                 │
│ Prisma ORM + Redis + Meilisearch                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ STORAGE & CDN (Cloudflare)                                  │
│ R2 (Object Storage) + CDN + DNS + Turnstile                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Technologies

### Core Framework

#### **Next.js 14+ (App Router)**
- **Version**: 14.0+ with App Router (RSC-first)
- **Rationale**:
  - Server-side rendering (SSR) for SEO and initial page load performance
  - Incremental Static Regeneration (ISR) for marketing pages
  - React Server Components for reduced client bundle size
  - Built-in API routes (used for NextAuth callbacks)
  - Edge middleware for tenant routing and auth gating
  - Vercel-optimized deployment with zero config
- **Trade-offs**:
  - Learning curve for App Router paradigm
  - RSC patterns may require refactoring from Pages Router mindset

#### **React 18+**
- **Version**: 18.2+
- **Rationale**:
  - Concurrent rendering for improved UX
  - Suspense for data fetching
  - Automatic batching for performance
  - Industry standard with massive ecosystem
- **Alternatives Considered**: Vue.js (rejected: smaller ecosystem for enterprise tooling)

#### **TypeScript 5+**
- **Version**: 5.0+
- **Rationale**:
  - Type safety across frontend/backend boundary (shared types)
  - Better DX with IntelliSense
  - Catch errors at compile time vs. runtime
  - Required for tRPC end-to-end type safety
- **Configuration**: Strict mode enabled

### Styling & UI

#### **Tailwind CSS 3+**
- **Version**: 3.4+
- **Rationale**:
  - Utility-first CSS for rapid prototyping
  - Small bundle size (purge unused styles)
  - Design system consistency via tailwind.config.js
  - No CSS-in-JS runtime cost
- **Plugins**: @tailwindcss/forms, @tailwindcss/typography

#### **shadcn/ui + Radix UI**
- **Version**: Latest (shadcn is copy-paste components)
- **Rationale**:
  - Accessible primitives (WCAG 2.1 AA compliant out-of-box)
  - Unstyled components (full Tailwind customization)
  - No package bloat (copy what you need)
  - Production-ready patterns (dialogs, dropdowns, tooltips)
- **Alternatives Considered**:
  - Material UI (rejected: heavy bundle size)
  - Chakra UI (rejected: CSS-in-JS overhead)
  - Ant Design (rejected: opinionated styling)

### State Management

#### **Zustand**
- **Version**: 4.0+
- **Rationale**:
  - Minimal boilerplate vs. Redux
  - TypeScript-first design
  - Small bundle size (~1KB)
  - Works seamlessly with React Server Components
  - Persistence middleware for local storage
- **Use Cases**: Client-side UI state (modals, filters, draft forms)
- **Alternatives Considered**:
  - Jotai (considered: more atomic, but Zustand simpler for our use case)
  - Redux Toolkit (rejected: overkill for our complexity)

#### **TanStack Query (React Query) v5**
- **Version**: 5.0+
- **Rationale**:
  - Server state management (caching, invalidation, refetching)
  - Optimistic updates for better UX
  - Automatic background refetching
  - Works with tRPC out-of-box
- **Use Cases**: API data fetching, caching, synchronization

### Form Handling

#### **React Hook Form**
- **Version**: 7.0+
- **Rationale**:
  - Uncontrolled inputs (better performance)
  - Built-in validation with resolver pattern
  - Integrates with Zod for schema validation
  - Small bundle size
- **Alternatives Considered**: Formik (rejected: larger, slower)

#### **Zod**
- **Version**: 3.0+
- **Rationale**:
  - Schema validation shared between frontend/backend
  - Type inference (DRY - schemas generate TypeScript types)
  - Runtime validation + compile-time types
  - Works with React Hook Form resolver
- **Use Cases**: Form validation, API input validation, environment variable validation

### Authentication

#### **NextAuth.js v5**
- **Version**: 5.0+ (formerly Auth.js)
- **Rationale**:
  - OAuth 2.0 / OIDC providers (Google, Microsoft, etc.)
  - Bring-your-own database (uses Prisma adapter)
  - Session management (JWT + database sessions)
  - CSRF protection built-in
  - SSO/SAML support (Phase 4)
- **Session Strategy**: Database sessions (for multi-device logout)

---

## Backend Technologies

### Core Framework

#### **NestJS 10+**
- **Version**: 10.0+
- **Rationale**:
  - Enterprise-grade Node.js framework (DI, modules, decorators)
  - TypeScript-first design
  - Built-in support for validation (class-validator)
  - Microservices-ready (future-proof)
  - Excellent documentation and ecosystem
  - Swagger/OpenAPI auto-generation
- **Architecture**: Modular monolith (easy to extract microservices later)
- **Alternatives Considered**:
  - Express.js (rejected: too barebones, manual DI)
  - Fastify (rejected: smaller ecosystem)
  - tRPC-only backend (rejected: need REST for webhooks)

#### **tRPC 10+**
- **Version**: 10.0+
- **Rationale**:
  - End-to-end type safety (frontend/backend share types)
  - No code generation (types inferred automatically)
  - Better DX than REST for internal APIs
  - Reduces API documentation burden
  - Works alongside NestJS (NestJS handles webhooks/REST)
- **Use Cases**: Internal client-server communication
- **Not Used For**: Webhooks (Stripe, Zoom, etc.) — those use REST

#### **Node.js v20 LTS**
- **Version**: 20.x LTS
- **Rationale**:
  - Long-term support until April 2026
  - Native fetch API (no need for axios)
  - Performance improvements over v18
  - Railway-supported version

### API & Data Validation

#### **class-validator + class-transformer**
- **Rationale**:
  - Decorator-based validation (NestJS native)
  - DTO validation for REST endpoints
  - Works with Swagger auto-docs
- **Use Cases**: REST endpoint validation (webhooks, public APIs)

#### **Zod** (Backend)
- **Rationale**:
  - Shared schemas with frontend
  - tRPC input/output validation
  - Environment variable validation (strict mode)

### Background Jobs

#### **BullMQ 5+**
- **Version**: 5.0+
- **Rationale**:
  - Redis-backed job queue
  - Cron jobs for scheduled tasks (reports, reminders)
  - Retry logic with exponential backoff
  - Job prioritization
  - Web UI for monitoring (Bull Board)
- **Use Cases**:
  - Email sending (async via Resend)
  - Webhook retries
  - Report generation (PDF/CSV exports)
  - Scheduled reminders (session RSVPs, action item due dates)
  - Data sync jobs (Jira/Asana/ClickUp bidirectional sync)

---

## Data Layer

### Primary Database

#### **PostgreSQL 15+**
- **Version**: 15+ (Railway managed)
- **Rationale**:
  - ACID compliance for critical business data
  - Row-Level Security (RLS) for multi-tenancy (critical requirement)
  - JSONB support for flexible metadata fields
  - Full-text search (tsvector) + trigram indexes
  - Proven at scale (10k+ concurrent connections possible)
  - PostGIS extension (if location features needed later)
- **Multi-Tenancy**: Single database + RLS policies (`tenant_id` column on all tables)
- **Backup Strategy**:
  - Daily automated Railway backups (7-day retention)
  - Weekly `pg_dump` to Cloudflare R2 (90-day retention)
  - Quarterly restore testing

#### **Prisma 5+**
- **Version**: 5.0+
- **Rationale**:
  - Type-safe database client (generated from schema)
  - Migration system (version-controlled schema changes)
  - Introspection for existing databases
  - Works with PostgreSQL RLS (connection-level `SET app.tenant_id`)
  - Excellent DX (auto-complete, error messages)
  - NextAuth.js adapter support
- **Schema Location**: `packages/api/prisma/schema.prisma`
- **Migration Strategy**: `prisma migrate deploy` on Railway startup

### Caching & Sessions

#### **Redis 7+**
- **Version**: 7.0+ (Railway managed)
- **Rationale**:
  - Session storage (NextAuth database sessions)
  - API response caching (hot data, aggregations)
  - BullMQ job queue backend
  - Rate limiting counters
  - Real-time features (pub/sub for WebSockets if needed)
- **Eviction Policy**: `allkeys-lru` (least recently used)
- **Persistence**: AOF (append-only file) for durability

### Search

#### **Meilisearch**
- **Version**: Latest (Railway managed)
- **Rationale**:
  - Fast full-text search (Rust-based, <50ms responses)
  - Typo tolerance (fuzzy matching)
  - Faceted search (filter by tags, dates, status)
  - Multi-language support (ES/EN)
  - Easy to deploy (single binary)
  - Alternative to Elasticsearch (simpler, lighter)
- **Use Cases**:
  - Member directory search
  - Feedback item search
  - Session notes search
  - Action item search
- **Sync Strategy**: Update Meilisearch indexes on Prisma hooks (post-create, post-update)

---

## Infrastructure & Deployment

### Deployment Constraints (Hard Requirements)

| Component | Provider | Rationale |
|-----------|----------|-----------|
| **Frontend** | **Vercel** | Next.js optimized; edge functions; zero-config; preview deploys |
| **Backend** | **Railway** | Unified compute/data; simple scaling; GitHub integration |
| **Database** | **Railway** | PostgreSQL + Redis + Meilisearch in one platform |
| **Storage** | **Cloudflare R2** | S3-compatible; no egress fees; CDN integration |
| **CDN** | **Cloudflare CDN** | Global edge cache; image resizing; DDoS protection |
| **DNS** | **Cloudflare** | Custom tenant domains; SSL certificates; DNS API |

### Hosting Platform Details

#### **Vercel (Frontend)**
- **Plan**: Pro ($20/mo per member) → Team ($20/mo per member)
- **Features Used**:
  - Automatic HTTPS
  - Edge middleware (tenant routing, auth checks)
  - Preview deployments (per-PR environments)
  - Environment variables per environment (prod/stage/preview)
  - Image optimization
  - ISR (Incremental Static Regeneration)
- **Regions**: Auto (edge functions globally distributed)
- **Build Command**: `pnpm build --filter=web`
- **Output Directory**: `packages/web/.next`

#### **Railway (Backend & Data)**
- **Plan**: Pro ($5/month platform + usage)
- **Services**:
  - NestJS API (Node.js service)
  - PostgreSQL (managed database)
  - Redis (managed database)
  - Meilisearch (managed service)
- **Features Used**:
  - GitHub auto-deploy (push to branch → deploy)
  - Environment variables
  - Horizontal scaling (multiple instances)
  - Health checks
  - Custom domains
- **Regions**: US-West (primary)
- **Start Command**: `pnpm start:prod --filter=api`

#### **Cloudflare (Storage & CDN)**
- **R2 Buckets**:
  - `coforma-uploads` (private: NDA docs, legal agreements)
  - `coforma-exports` (private: CSV/PDF reports, signed URLs)
  - `coforma-public` (public: logos, avatars, case study assets)
- **CDN**:
  - Cache-Control headers for static assets
  - Image resizing (cf-images worker)
  - Signed URLs for private files (time-limited access)
- **DNS**:
  - Tenant subdomain routing (`tenant-slug.coforma.studio`)
  - Custom domain support (`cab.customer.com` → CNAME to Vercel)
- **Turnstile**: CAPTCHA alternative for public forms

---

## Third-Party Integrations

### Payment & Billing

#### **Stripe**
- **Products Used**:
  - Billing (subscriptions, metered usage)
  - Tax API (automatic sales tax calculation)
  - Invoicing
  - Customer Portal
- **Rationale**:
  - Industry standard for SaaS billing
  - Supports usage-based pricing (per-active-member metering)
  - Webhooks for subscription lifecycle events
  - PCI compliance handled by Stripe

### Communication & Collaboration

#### **Resend (Email)**
- **Rationale**:
  - Developer-friendly (REST API + React Email templates)
  - Deliverability focus
  - Webhook support (bounce/spam reports)
  - Affordable ($0.10/1000 emails)
- **Use Cases**: Invitations, reminders, reports, notifications

#### **Zoom**
- **Integration**: OAuth + Webhooks
- **Use Cases**:
  - Auto-create meeting links for sessions
  - Capture attendance data
  - Recording retrieval
- **API**: Zoom Meetings API v2

#### **Slack**
- **Integration**: OAuth + Webhooks + Bot API
- **Use Cases**:
  - Send session summaries to company Slack
  - Notify on new feedback items
  - Action item reminders
- **API**: Slack Web API + Events API

### Project Management

#### **Jira / Asana / ClickUp**
- **Integration**: OAuth + REST APIs + Webhooks
- **Use Cases**:
  - Bidirectional sync (feedback items ↔ tickets)
  - Link CAB feedback to shipped features
  - Feedback-to-Implementation Ratio tracking
- **Sync Strategy**:
  - Webhook-driven (real-time updates)
  - Nightly reconciliation job (catchall for missed webhooks)

### Calendar

#### **Google Calendar**
- **Integration**: OAuth + Google Calendar API v3
- **Use Cases**:
  - Session scheduling
  - Send calendar invites
  - Sync session times
- **Scopes**: `calendar.events` (read/write)

---

## Developer Experience

### Monorepo Management

#### **pnpm Workspaces**
- **Version**: 8.0+
- **Rationale**:
  - Fast installs (content-addressable storage)
  - Disk space efficient (symlinks)
  - Strict dependency resolution (no phantom deps)
  - Better than npm/yarn for monorepos
- **Configuration**: `pnpm-workspace.yaml`

#### **Turborepo**
- **Version**: 1.10+
- **Rationale**:
  - Parallel task execution (build, test, lint)
  - Smart caching (only rebuild what changed)
  - Remote caching (share builds across team/CI)
  - Works with pnpm workspaces
- **Configuration**: `turbo.json`
- **Tasks**: `build`, `dev`, `test`, `lint`, `typecheck`

### Code Quality

#### **ESLint 8+**
- **Plugins**:
  - `@typescript-eslint` (TypeScript rules)
  - `eslint-plugin-react` (React best practices)
  - `eslint-plugin-react-hooks` (hooks rules)
  - `eslint-plugin-import` (import order)
  - `eslint-plugin-security` (security linting)
- **Config**: `eslint.config.js` (flat config)

#### **Prettier 3+**
- **Rationale**: Opinionated formatter (no bikeshedding)
- **Integration**: `eslint-plugin-prettier` (run via ESLint)
- **Config**: `.prettierrc`

#### **Husky + lint-staged**
- **Husky**: Git hooks (pre-commit, pre-push)
- **lint-staged**: Run linters on staged files only (fast commits)
- **Hooks**:
  - Pre-commit: lint + format staged files
  - Pre-push: type check + test

### Testing

#### **Vitest**
- **Version**: 1.0+
- **Rationale**:
  - Vite-powered (fast)
  - Jest-compatible API
  - ESM support (better than Jest for modern TS)
  - TypeScript out-of-box
- **Use Cases**: Unit tests, integration tests

#### **Playwright**
- **Version**: 1.40+
- **Rationale**:
  - Cross-browser E2E testing
  - Auto-wait (no flaky tests from race conditions)
  - Network mocking
  - Parallel execution
  - Video/screenshot on failure
- **Use Cases**: Critical user flows (signup, CAB creation, session scheduling)

---

## Security & Compliance

### Authentication & Authorization

#### **NextAuth.js (Auth.js) v5**
- **Session Strategy**: Database sessions (Redis-backed)
- **CSRF Protection**: Built-in (SameSite=Lax cookies)
- **OAuth Providers**: Google, Microsoft, custom OIDC
- **SSO/SAML**: Phase 4 (via Auth.js Enterprise)

#### **CASL (Attribute-Based Access Control)**
- **Version**: 6.0+
- **Rationale**:
  - Flexible RBAC + ABAC
  - Define permissions per resource + tenant
  - Works with Prisma models
  - Type-safe ability checks
- **Roles**: Admin, Facilitator, Member (per tenant)

### Security Tools

#### **Helmet**
- **Rationale**: Secure HTTP headers (CSP, HSTS, X-Frame-Options)
- **Integration**: NestJS middleware

#### **express-rate-limit**
- **Rationale**: API rate limiting (prevent abuse)
- **Strategy**: Redis-backed (shared state across instances)

#### **Cloudflare Turnstile**
- **Rationale**: CAPTCHA alternative (privacy-focused)
- **Use Cases**: Public forms, signup, password reset

### Secrets Management

- **Local Development**: `.env.local` (gitignored)
- **Production**: Vercel environment variables + Railway environment variables
- **Rotation**: Quarterly manual rotation (API keys, database passwords)
- **No Secrets in Code**: Enforced via `eslint-plugin-security` + git-secrets pre-commit hook

### Compliance

- **GDPR** (EU): Data portability, right to deletion, consent management
- **LGPD** (Brazil): Similar to GDPR
- **WCAG 2.1 AA**: Accessibility via Radix UI primitives

---

## Monitoring & Operations

### Error Tracking

#### **Sentry**
- **Version**: 7.0+
- **Rationale**:
  - Real-time error tracking (frontend + backend)
  - Stack traces with source maps
  - Release tracking (link errors to deployments)
  - Performance monitoring (transaction tracing)
- **Alerts**: Slack integration for critical errors

### Logging

#### **Better Stack (Logtail)**
- **Rationale**:
  - Structured logging (JSON)
  - Querying & dashboards
  - Affordable ($0.25/GB)
  - Better UX than ELK stack
- **Sources**: NestJS (Winston transport), Vercel (log drain)

### Analytics

#### **PostHog**
- **Version**: 3.0+
- **Rationale**:
  - Product analytics (event tracking)
  - Session replay
  - Feature flags
  - A/B testing
  - Self-hostable (if needed for compliance)
  - Privacy-focused (GDPR-ready)
- **Events Tracked**:
  - CAB created
  - Session scheduled
  - Feedback submitted
  - Action item created
  - Discount applied

### Uptime Monitoring

#### **Better Uptime**
- **Rationale**:
  - HTTP/TCP checks (API health, DB connectivity)
  - Status page (public incidents)
  - Incident management
  - Integrates with Better Stack
- **Checks**:
  - Frontend (Vercel): 1-min interval
  - Backend API (Railway): 1-min interval
  - Database (Railway): 5-min interval

---

## Technology Decision Rationale

### Why Monorepo?
- **Shared types**: Frontend/backend share TypeScript interfaces (DRY)
- **Atomic commits**: Change API + client in same PR
- **Simplified versioning**: One repo, one version, one deploy
- **Code reuse**: Shared utilities, validation schemas

### Why Next.js App Router over Pages Router?
- **Future-proof**: React Server Components are the future
- **Performance**: Smaller client bundles (server components)
- **DX**: Collocate data fetching with UI
- **Streaming**: Suspense-based progressive rendering

### Why NestJS + tRPC (not just tRPC)?
- **tRPC alone**: No built-in DI, modules, decorators
- **NestJS**: Enterprise patterns, Swagger docs, microservices-ready
- **Hybrid**: tRPC for internal APIs (type safety), NestJS REST for webhooks

### Why PostgreSQL RLS over App-Level Multi-Tenancy?
- **Defense in Depth**: Even if app logic fails, DB enforces isolation
- **Regulatory**: Required for GDPR/LGPD compliance (data residency)
- **Audit**: RLS policies are database-versioned and testable

### Why Railway over AWS/GCP?
- **Simplicity**: No DevOps team (yet)
- **DX**: GitHub integration, simple scaling
- **Cost**: Predictable pricing vs. AWS surprise bills
- **Migration Path**: Can move to Kubernetes later if needed

### Why Vercel over Self-Hosted Next.js?
- **Zero Config**: Deploy Next.js with zero DevOps
- **Edge**: Global CDN + edge functions (tenant routing)
- **Preview Deploys**: Per-PR environments (critical for collaboration)
- **ISR**: Incremental Static Regeneration (no CDN purge needed)

### Why Cloudflare R2 over AWS S3?
- **No Egress Fees**: S3 charges $0.09/GB for bandwidth; R2 is free
- **CDN Integration**: R2 + Cloudflare CDN = seamless
- **Simplicity**: No AWS account, IAM complexity

---

## Operational Runbooks

### Local Development Setup

```bash
# Prerequisites: Node.js v20+, pnpm v8+, Docker (for local PostgreSQL/Redis)

# 1. Clone repository
git clone <repo-url>
cd coforma-studio

# 2. Install dependencies
pnpm install

# 3. Start local services (Docker Compose)
docker-compose up -d  # PostgreSQL, Redis, Meilisearch

# 4. Configure environment variables
cp .env.example .env.local
# Edit .env.local with local database URLs

# 5. Run database migrations
pnpm --filter=api prisma migrate dev

# 6. Seed database (optional)
pnpm --filter=api prisma db seed

# 7. Start development servers
pnpm dev  # Runs both frontend + backend via Turborepo

# Frontend: http://localhost:3000
# Backend: http://localhost:4000
```

### Deployment Workflow

#### Stage Environment
```bash
git push origin develop  # Auto-deploys to stage.coforma.studio
```

#### Production Environment
```bash
git checkout main
git merge develop
git push origin main  # Auto-deploys to coforma.studio
```

### Database Migration (Production)

```bash
# 1. Create migration locally
pnpm --filter=api prisma migrate dev --name add_xyz_table

# 2. Commit migration files
git add packages/api/prisma/migrations
git commit -m "feat(db): add xyz table"

# 3. Deploy (Railway auto-runs migrations on startup)
git push origin main

# 4. Verify migration in Railway logs
railway logs --service=api
```

### Secret Rotation

**Quarterly Schedule:**
1. Database passwords (PostgreSQL, Redis)
2. Stripe API keys (test + live)
3. OAuth client secrets (Google, Microsoft)
4. NextAuth secret
5. Encryption keys (if any)

**Process:**
1. Generate new secret via provider dashboard
2. Update Railway/Vercel environment variables
3. Trigger redeploy (zero-downtime via Railway)
4. Verify health checks pass
5. Revoke old secret after 24-hour grace period

---

## Version Support Policy

| Technology | Current Version | Upgrade Cadence | LTS Policy |
|------------|----------------|-----------------|------------|
| Node.js | v20 LTS | Every 2 years (LTS cycle) | Until April 2026 |
| PostgreSQL | 15+ | Every 3 years | Until Nov 2027 |
| Next.js | 14+ | Every minor (assess breaking changes) | N/A (rapid release) |
| NestJS | 10+ | Every major (assess breaking changes) | N/A |
| React | 18+ | Every major | N/A |

**Dependency Updates:**
- **Security patches**: Immediate (Dependabot auto-PR)
- **Minor versions**: Monthly review
- **Major versions**: Quarterly assessment

---

## Future Considerations

### Phase 2+ (Months 6–12)
- **GraphQL**: If REST/tRPC becomes limiting (unlikely)
- **WebSockets**: Real-time collaboration (Socket.io or Pusher)
- **Kubernetes**: If Railway scaling becomes limiting (unlikely until 1000+ tenants)
- **Multi-Region**: If latency becomes issue (Cloudflare Workers for read-heavy queries)

### Phase 4+ (Year 2+)
- **AI/ML**: Claude/GPT-4 for facilitation assistance, sentiment analysis
- **Mobile Apps**: React Native (share tRPC client logic)
- **White-Label SSO**: Custom SAML/OIDC providers per tenant
- **Advanced Analytics**: Snowflake or BigQuery for data warehousing

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2)

---

**Last Updated**: 2025-11-14
**Maintained By**: Engineering Lead
**Review Cadence**: Quarterly
