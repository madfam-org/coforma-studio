# SOFTWARE\_SPEC.md — Coforma Studio

**Product:** Coforma Studio
**Primary Domain:** coforma.studio
**Builder:** Aureo Labs (a MADFAM company) — aureolabs.dev / madfam.io
**Version:** v1.1 (Updated with Vercel + Railway + Cloudflare infra)
**Owner:** Aldo Ruiz Luna

---

## 0) Executive Summary

Coforma Studio is a **multi-tenant SaaS** that operationalizes **Customer Advisory Boards (CABs)** as a repeatable growth engine. It lets companies **recruit, run, and monetize** customer councils; capture structured insights; tie those insights to product roadmaps; and manage incentives (discounts/credits/referrals) with measurable ROI. The platform is designed for **LATAM-first usability** and **global-scale reliability**.

**Infra constraints (hard):**

* Frontends → **Vercel**
* APIs/DB/Backends → **Railway**
* Object storage & CDN → **Cloudflare (R2 + CDN)**

---

## 1) Objectives & Success Criteria

**Business Objectives**

1. Run MADFAM’s own CABs to accelerate PMF across productized platforms.
2. Monetize externally as “**Advisory‑as‑a‑Service (AaaS)**” multi-tenant SaaS.
3. Reduce CAC and churn for customers by enabling co-creation & referrals.

**Success Criteria (12 months)**

* ≥ 3 internal MADFAM CABs fully live; **feedback→feature** cycle time ≤ 30 days.
* ≥ 10 paying external tenants; gross logo retention ≥ 95%.
* Referral-attributed pipeline ≥ 20% of tenants’ new deals.
* Platform NPS ≥ 50; Monthly Active Members/Invited ≥ 60%.

---

## 2) Personas & Primary Use Cases

**Personas**

* **CAB Admin (Tenant Admin):** owns configuration, invites, billing.
* **Facilitator:** plans sessions, collects/triages feedback, publishes minutes.
* **CAB Member:** participates, submits feedback, votes, earns recognition/credits.
* **Exec Stakeholder:** consumes dashboards, approves roadmap links, exports reports.

**Top Use Cases**

1. Create a new CAB (cohort, goals, cadence, NDA/discount terms).
2. Invite members, manage roles, track acceptance & onboarding.
3. Plan/run sessions (agenda, materials, recording links, minutes, action items).
4. Collect feedback (forms, polls, threads) and **link to roadmap** (Jira/Asana/ClickUp).
5. Manage incentives (discounts, credits, referrals) with expiries and audit logs.
6. Report outcomes (engagement, features shipped, revenue influenced, testimonials).

---

## 3) Functional Requirements

### 3.1 CAB & Member Management

* Create/edit CABs; cohort tags; capacity limits; visibility (private/invite-only).
* Invite flows: email + magic link; require NDA/terms e‑sign; configurable discount plan.
* Roles: Admin / Facilitator / Member; granular permissions (RBAC + ABAC).
* Member directory with tags (power user, influencer, strategic).

### 3.2 Sessions & Collaboration

* Calendar scheduling (Google Calendar) + Zoom/Meet links.
* Agenda builder; attachments from R2; time-boxed sections; presenter assignment.
* Minutes + decisions; action items with owners & due dates.
* Polls/surveys; asynchronous threads; emoji/vote reactions.

### 3.3 Feedback → Roadmap

* Feedback item types: idea, bug, request, research insight.
* Tagging (priority, product area, segment) + deduplication suggestions.
* Link to tasks (Jira/Asana/ClickUp) with bi-directional status sync.
* **Feedback‑to‑Implementation Ratio** metric; time‑to‑decision; changelog notes.

### 3.4 Incentives & Recognition

* Discount plan templates (percent, cap, expiry, renewal rules).
* Referral program (tracked invites, approvals, rewards/credits).
* Badges (Founding Partner, Influencer, Top Contributor); leaderboards.
* Case-study workflow (consent, draft, publication).

### 3.5 Analytics & Reporting

* Engagement: attendance, talk time, submission rates, read rates.
* Program health: member activity cohorts, churn risk, referral velocity.
* Business impact: revenue influenced, deals referenced, features shipped.
* Exports: PDF/CSV; scheduled email reports to execs.

### 3.6 Tenanting & Branding

* Tenant settings (name, logo, colors, locale, time zone, currency).
* Subdomain (`tenant.coforma.studio`) + custom domain (`cab.brand.com`) with Cloudflare DNS.
* Legal pages per tenant (privacy, DPA references); email templates localized (ES/EN).

---

## 4) Non‑Functional Requirements

* **Availability:** 99.9% monthly; graceful degradation for non-critical features.
* **Performance:** P95 < 300ms for cached reads; P95 < 800ms for standard writes.
* **Scalability:** 1→100 tenants without re-architecture; 10k concurrent members aggregate.
* **Security:** RLS at DB; least-privilege; end‑to‑end audit logs; secrets rotation.
* **Privacy/Compliance:** GDPR, LGPD (BR), Mexican data principles; DSR endpoints.
* **Localization:** ES/EN first-class; pluggable i18n.
* **Accessibility:** WCAG 2.1 AA.

---

## 5) System Architecture (Aligned to Infra Constraints)

**Frontend (Vercel)**

* Next.js (App Router), Tailwind, shadcn/ui; Edge Middleware for tenant routing & auth gating.
* Static + ISR content; Next/Image; env segmentation per Vercel project (prod/stage/preview).

**API & Workers (Railway)**

* NestJS (Node 20+), tRPC + REST; BullMQ workers (Redis) for jobs (emails, search indexing, webhooks).
* Webhooks for Stripe, Zoom, Slack, Jira/Asana, Resend.

**Data (Railway)**

* PostgreSQL (Prisma ORM) with **Row‑Level Security**; single DB, shared schema keyed by `tenant_id`.
* Redis (Railway) for caching, sessions (optional), queues.
* Meilisearch (Railway) for feedback/member/session search.

**Storage & Delivery (Cloudflare)**

* R2 buckets: uploads, exports, public; signed URLs; CDN cache; optional image resizing.
* Cloudflare DNS & proxy for custom tenant domains; Turnstile on forms.

**Observability**

* Sentry (errors), Better Stack/Logtail (logs), PostHog (product analytics).

**Payments**

* Stripe Billing (tiers, seats, metering; MXN/USD/EUR; Stripe Tax).

---

## 6) Data Model (High-Level)

* `tenants(id, name, locale, timezone, plan, …)`
* `tenant_domains(tenant_id, domain, verified)`
* `users(id, email, profile)`
* `memberships(user_id, tenant_id, role)`
* `cabs(id, tenant_id, name, goals, cadence, visibility)`
* `sessions(id, cab_id, starts_at, agenda_json, minutes_json, recording_url)`
* `invites(id, cab_id, email, token, status)`
* `agreements(id, tenant_id, type, file_url, version, signed_by, signed_at)`
* `feedback_items(id, cab_id, author_id, type, title, body, tags[], priority, status)`
* `feedback_links(id, feedback_id, external_system, external_id, status)`
* `polls(id, cab_id, config_json)` / `votes`
* `credits_discounts(id, tenant_id, member_id, plan_id, pct, cap, expires_at)`
* `referrals(id, tenant_id, referrer_id, referred_email, status, reward)`
* `analytics_events(id, tenant_id, user_id, name, props, ts)`

**RLS Policy:** every table includes `tenant_id` (or is derivable) and enforces `current_setting('app.tenant_id') = tenant_id`.

---

## 7) API Surface (Initial)

* **Auth:** `/auth/*` (NextAuth) — OAuth/SAML (later via WorkOS).
* **Tenants:** CRUD + domain verify.
* **CABs & Sessions:** CRUD; agenda/minutes; attachments (R2 signed URLs).
* **Feedback:** CRUD; tags; search; link/unlink to Jira/Asana/ClickUp tasks.
* **Incentives:** discounts/credits CRUD; referral endpoints; audit events.
* **Reports:** prebuilt queries → CSV/PDF exports (worker-generated, stored in R2).
* **Integrations:** OAuth installs per tenant; webhook receivers.

---

## 8) Security

* TLS 1.3; HSTS.
* Least-privilege RBAC + ABAC (CASL).
* Signed URLs for file access; private buckets for legal docs.
* CSRF (SameSite Lax), rate limits (Redis), IP throttling via Cloudflare.
* Secrets in Railway/Vercel env; quarterly rotation; no secrets in code.
* Backups: daily Railway backups + weekly `pg_dump` to R2; quarterly restore tests.

---

## 9) Pricing & Packaging (Public)

* **Starter** (\$500–\$1k/mo): up to 25 members, 1 CAB, core analytics, CSV export.
* **Growth** (\$2–\$3k/mo): 3–5 CABs, 100 members, integrations, advanced analytics.
* **Enterprise** (\$5k+/mo): unlimited CABs/members, SSO/SAML, API, custom SLAs, sandbox env.
* **Add‑ons:** facilitation training, managed CAB ops, insights bundles.

---

## 10) Rollout Plan

**Phase 0 (Weeks 0–2):** repo, envs, CI/CD, seed data, auth skeleton.
**Phase 1 (Weeks 3–10):** MVP → CABs, invites, sessions, basic feedback, R2 uploads, reports v0.
**Phase 2 (Weeks 11–20):** multi-tenant; incentives; Jira/Asana/ClickUp; analytics v1.
**Phase 3 (Weeks 21–32):** referrals; custom domains; Meilisearch; dashboards; case-study flow.
**Phase 4 (Weeks 33–52):** SAML/SCIM; AI clustering (pgvector); marketplace of facilitators.

Gate for public beta: 2 design partners live ≥ 60 days, churn 0, MTTR < 2h, P95 latency targets met.

---

## 11) Risks & Mitigations

* **Discount anchoring:** time/volume-bound plans; clear graduation paths.
* **Feedback bias:** sample diversity checks; segment weighting; validation studies.
* **Multi-tenant data leaks:** strict RLS; integration tests; chaos drills.
* **Overbuild risk:** feature flags; usage analytics; kill low‑usage features quickly.

---

## 12) KPIs & Operational Dashboards

* Product: MAU, session attendance rate, feedback→implementation ratio, time‑to‑decision.
* Growth: tenant count, ARPA, net revenue retention, referral‑attributed pipeline.
* Reliability: uptime, P95 latency, error rate, job queue delays, restore RTO/RPO.
* CS: NPS, admin satisfaction (CES), member churn.

---

## 13) Acceptance Criteria (MVP)

* Create a tenant, configure branding, add domain, invite ≥ 10 members.
* Run a session end‑to‑end: agenda → recording link → minutes → action items.
* Submit feedback, tag it, and link to a Jira/Asana/ClickUp task; status reflected back.
* Assign a discount to a member with expiry; ledger visible in audit log.
* Export a quarterly report (CSV/PDF) with engagement and impact metrics.

---

## 14) Appendices

* See **TECH\_STACK.md** for detailed component choices and ops runbooks.
* See **Brand Narrative** doc for positioning and copy baselines.
