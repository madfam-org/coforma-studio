# Coforma Studio

**Domain:** [coforma.studio](https://coforma.studio)
**Developer:** Aureo Labs ([aureolabs.dev](https://aureolabs.dev))
**Parent Company:** Innovaciones MADFAM S.A.S. de C.V. ([madfam.io](https://madfam.io))

---

## Overview

Coforma Studio is a **multi-tenant SaaS platform** designed to help companies create, manage, and scale **Customer Advisory Boards (CABs)**. By combining structured feedback loops, engagement hubs, and incentive mechanisms, it transforms CABs into **growth engines** that accelerate product-market fit, strengthen loyalty, and reduce customer acquisition costs.

Built with a **LATAM-first ethos** and designed for **global scalability**, Coforma Studio introduces a new category: **Advisory-as-a-Service (AaaS)**.

**📊 Current Status:** Foundation Phase (40% Complete) - [View Project Status](./PROJECT_STATUS.md)

---

## Key Features

* **Recruitment & CRM:** Manage CAB candidate pipelines, contracts, and onboarding.
* **Engagement Hub:** Schedule sessions, share agendas/minutes, and collect structured feedback.
* **Roadmap Linkage:** Tie customer feedback directly to Jira, Asana, or ClickUp tasks.
* **Incentives & Recognition:** Discounts, referral programs, badges, and spotlight features.
* **Analytics & ROI:** Engagement dashboards, revenue influence tracking, and executive-ready reports.

---

## Architecture

* **Frontend:** Next.js (React + TailwindCSS) on **Vercel**.
* **Backend/API:** Node.js (NestJS) on **Railway**.
* **Database:** PostgreSQL (RLS enforced multi-tenancy) on **Railway**.
* **Cache/Queue:** Redis (Railway) with BullMQ for background jobs.
* **Search:** Meilisearch (Railway).
* **Storage & CDN:** Cloudflare R2 + Cloudflare CDN for file storage and delivery.
* **Integrations:** Zoom, Slack, Jira, Asana, ClickUp, HubSpot, Stripe.
* **Authentication:** NextAuth.js (OAuth2.0, OIDC, SSO).

---

## Monetization

* **Starter (\$500–1k/mo):** Up to 25 CAB members, basic CRM, event management.
* **Growth (\$2–3k/mo):** Up to 100 members, integrations, advanced analytics.
* **Enterprise (\$5k+/mo):** Unlimited members, full white-label, API access, and custom SLAs.

**Add-ons:** facilitation training, managed services, insights packages.

---

## Roadmap

* **Phase 1 (0–6 months):** Internal pilot with MADFAM CABs; MVP with recruitment, engagement, and dashboards.
* **Phase 2 (6–12 months):** SaaS MVP launch; 1–2 pilot external clients; billing via Stripe.
* **Phase 3 (12–24 months):** Productization with white-labeling, integrations, and advanced analytics.
* **Phase 4 (24+ months):** AI-assisted facilitation, facilitator marketplace, enterprise/gov adoption.

---

## Success Metrics

* Internal CAB adoption at MADFAM.
* Retention rates beyond discount phases.
* SaaS revenue growth from external tenants.
* Referral-attributed pipeline generation.
* Net Promoter Score (NPS) and PMF fit score.

---

## Strategic Advantage

By building Coforma Studio, MADFAM both **improves its own product development cycle** and **creates a monetizable SaaS platform** for the wider market. The result is dual leverage: stronger internal innovation and recurring external revenues. This positions MADFAM as a **pioneer of Advisory-as-a-Service** and a **solarpunk innovation leader** in LATAM with global reach.

---

## Development Setup

### Prerequisites

- **Node.js** v20+ (LTS)
- **pnpm** v8+
- **Docker** & Docker Compose
- **Git**

### NPM Registry Configuration

Coforma Studio uses MADFAM's private npm registry for internal packages. Configure your `.npmrc`:

```bash
# Add to your project's .npmrc or ~/.npmrc
@madfam:registry=https://npm.madfam.io
@coforma:registry=https://npm.madfam.io
@janua:registry=https://npm.madfam.io
//npm.madfam.io/:_authToken=${NPM_MADFAM_TOKEN}
```

Set the `NPM_MADFAM_TOKEN` environment variable with your registry token.

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/madfam-io/coforma-studio.git
cd coforma-studio

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Start local services (PostgreSQL, Redis, Meilisearch)
docker-compose up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Seed the database (optional)
pnpm db:seed

# 7. Start development servers
pnpm dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Prisma Studio**: http://localhost:5555 (run `pnpm db:studio`)

### Project Structure

```
coforma-studio/
├── packages/
│   ├── web/              # Next.js frontend
│   ├── api/              # NestJS backend
│   ├── types/            # Shared TypeScript types
│   └── ui/               # Shared UI components (shadcn/ui)
├── docs/                 # Documentation
│   ├── api-specification.md
│   ├── database-schema.md
│   └── deployment.md
├── .github/
│   └── workflows/        # CI/CD pipelines
├── scripts/              # Utility scripts
├── docker-compose.yml    # Local development services
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspaces
```

### Available Commands

```bash
# Development
pnpm dev                  # Start all services in development mode
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm lint                 # Run ESLint
pnpm format               # Format code with Prettier
pnpm typecheck            # Run TypeScript type checking

# Database
pnpm db:migrate           # Run database migrations
pnpm db:seed              # Seed database with sample data
pnpm db:studio            # Open Prisma Studio (database GUI)
pnpm db:reset             # Reset database (WARNING: deletes all data)
```

---

## Documentation

### Project Status & Reports
- **[📊 Project Status](./PROJECT_STATUS.md)** - **Current status and progress** (Authoritative)
- **[🔍 Latest Audit](./COMPREHENSIVE_AUDIT_2025-11-19.md)** - Comprehensive audit (2025-11-19)
- **[🔐 RLS Implementation](./RLS_IMPLEMENTATION_SUMMARY.md)** - Multi-tenant security details

### Product & Planning
- **[Product Vision](./PRODUCT_VISION.md)** - Mission, vision, and guiding principles
- **[Software Specification](./SOFTWARE_SPEC.md)** - Detailed technical requirements
- **[Technology Stack](./TECH_STACK.md)** - Technology decisions and rationale
- **[Operating Model](./OPERATING_MODEL.md)** - Team structure and processes
- **[Business Development](./BIZ_DEV.md)** - Go-to-market strategy

### Development
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute
- **[Security Policy](./SECURITY.md)** - Security practices and reporting
- **[API Specification](./docs/api-specification.md)** - API documentation
- **[Database Schema](./docs/database-schema.md)** - Database structure and RLS policies
- **[Deployment Guide](./docs/deployment.md)** - Deployment procedures
- **[Testing Guide](./packages/api/test/README.md)** - How to run and write tests

### Archive
- **[Historical Docs](./docs/archive/)** - Outdated documentation (preserved for reference)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## License

Proprietary - All Rights Reserved

Copyright © 2025 Innovaciones MADFAM S.A.S. de C.V.

---

## Support

- **Documentation**: See [docs/](./docs/) directory
- **Issues**: [GitHub Issues](https://github.com/madfam-io/coforma-studio/issues)
- **Email**: hello@aureolabs.dev
- **Website**: [aureolabs.dev](https://aureolabs.dev)
