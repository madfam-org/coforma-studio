# OPERATING\_MODEL.md — Coforma Studio

**Product:** Coforma Studio
**Domain:** [coforma.studio](https://coforma.studio)
**Developer:** Aureo Labs ([aureolabs.dev](https://aureolabs.dev))
**Parent Company:** Innovaciones MADFAM S.A.S. de C.V. ([madfam.io](https://madfam.io))

---

## 1. Purpose

This document defines the **operating model** for Coforma Studio. It translates the **vision (why)** and **spec (what)** into **execution (how)** — aligning teams, processes, and metrics.

---

## 2. Org Model & Roles

* **Product & Engineering (Aureo Labs):**

  * Owns product roadmap, design, development, infra, and QA.
  * Ensures compliance, scalability, and UX excellence.
* **Business Development (MADFAM BizDev/Founders):**

  * Owns GTM strategy, partnerships, and revenue growth.
  * Builds pipeline, closes early design partners, manages pricing experiments.
* **Customer Success & Facilitation:**

  * Owns CAB health for both MADFAM internal and external tenants.
  * Runs facilitation services and drives engagement metrics.
* **Operations & Finance:**

  * Owns billing, legal, compliance, and financial forecasting.
  * Tracks SaaS KPIs (ARR, CAC, churn, retention).

---

## 3. Operating Cadence

* **Daily (async-first):** Slack/Linear standups; Vercel preview PR reviews.
* **Weekly:**

  * Product sprint planning + demo (Eng/Product).
  * Growth sync (BizDev + Success + Ops).
* **Monthly:**

  * CAB health review (attendance, feedback-to-implementation ratio).
  * Financial dashboard: MRR, ARR, CAC, runway.
* **Quarterly:**

  * Strategic offsite (roadmap, GTM pivots, pricing review).
  * Vision alignment check-in (compare to PRODUCT\_VISION.md horizon goals).

---

## 4. Decision Framework

* **Reversible (Type 2) Decisions:**

  * Delegated to team leads (e.g., UI design choices, minor integrations).
* **Irreversible (Type 1) Decisions:**

  * Escalated to founders/leadership (e.g., pricing tiers, infra migrations, core architecture).
* **Guiding heuristic:** Speed > perfection for Type 2; deliberation > speed for Type 1.

---

## 5. Metrics & Ownership

* **Product (Aureo Labs):**

  * Feedback-to-Implementation Impact Rate (FIIR).
  * P95 latency & uptime.
  * Active tenants & members.
* **BizDev (MADFAM):**

  * Tenant count, ARPA, ARR.
  * Referral-attributed pipeline %.
* **Customer Success:**

  * Engagement rate (attendance, feedback submissions).
  * Net Promoter Score (NPS).
  * Churn rate.
* **Operations/Finance:**

  * Gross margin, CAC\:LTV ratio.
  * Compliance adherence (GDPR, LGPD).

---

## 6. Tooling & Workflow

* **Code & Infra:** GitHub (monorepo), Vercel (frontend), Railway (API/DB/queues), Cloudflare (R2+CDN).
* **Project Mgmt:** Linear or Jira.
* **Comms:** Slack + Notion for async docs.
* **CRM:** HubSpot (pilot), Salesforce (enterprise tier expansion).
* **Analytics:** PostHog (product), Sentry (errors), Better Stack (logs/uptime).
* **Finance:** Stripe Billing + internal MADFAM reporting.

---

## 7. Risk Management & Governance

* **Data Security:** Enforced via RLS, TLS, regular backups, restore drills.
* **Discount Phase Risk:** Monitor graduation paths; build upsell playbooks early.
* **CAB Feedback Bias:** Diversify CAB composition; validate with non-CAB data.
* **Resource Allocation:** Ruthless prioritization by impact × urgency × reversibility.

---

## 8. Alignment to Vision

* Every quarter, leadership revisits **PRODUCT\_VISION.md** to:

  * Check fidelity to mission (“build with, not for”).
  * Ensure FIIR (north star metric) is tracked and improving.
  * Adjust operating cadence/tools as needed to stay aligned with horizon goals.

---

### Closing Statement

The **operating model** ensures Coforma Studio is not just a product, but a **repeatable system**: ideas flow into execution, execution into insights, insights back into vision — creating a continuous loop of innovation, growth, and alignment.
