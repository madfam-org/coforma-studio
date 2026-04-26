# Tezca CAB — Candidate Identification & Outreach Playbook

**Last Updated:** 2026-04-25
**Owner:** Founder (Aldo Ruiz Luna)
**Cohort:** Spring 2026 (Q2 2026, first session week of 2026-05-15)
**Reference:** RFC 0013 Wave PMF-3 · ADR-003 (Tulana ↔ Coforma) · Coforma `Tenant: madfam-internal` / `CAB: tezca-spring-2026`

---

## 1. Cohort sizing

- **Target:** 5–15 active members per quarter.
- **Recruiting funnel rule of thumb:** invite 3× target (~30 candidates) to land 5–15 confirmed attendees on schedule.
- **Cadence:** quarterly cohort refresh; rolling replacement allowed mid-quarter if a member churns.

## 2. Selection criteria (any one is sufficient; all three is ideal)

A candidate qualifies if **any** of the following is true:

1. **Active Tezca API key user** — ≥10 successful API calls in the last 30 days.
   - Source: query against `apps/api/billing_views.py` data in the Tezca repo (operator pulls manually for v0.1; automation deferred).
   - Filter: exclude internal MADFAM tokens, monitoring probes, smoke-test keys.

2. **PhyneCRM "engaged" lead** — opened ≥3 outreach emails OR replied to any outreach in the last 90 days.
   - Source: PhyneCRM `engagement.score >= 0.3` dashboard segment.

3. **Self-nominated via in-app smile/frown widget** (Tulana feed).
   - Source: Tulana `pmf.smile_frown_responses` where `user_opted_in_to_research = true`.

## 3. Diversity targets (cohort composition)

The cohort is too small to be statistically representative, but we anchor on the following soft targets so feedback is not monoculture:

| Dimension | Target | Rationale |
|---|---|---|
| Institutional users (gov / university / NGO) | ≥30% | Tezca's positioning hypothesis; need signal from the segment most likely to pay enterprise tier. |
| Geography outside Mexico City | ≥20% | Avoid Anáhuac-bubble bias; LATAM-wide product. |
| Academic researchers | ≥1 | Primary research-use-case validators. |
| Enterprise compliance officers | ≥1 | Validates the "legal-data-as-API" framing for regulated buyers. |

If a cohort can't hit a target, log it in the kickoff session minutes and adjust the next quarter's outreach list.

## 4. Outreach mechanics

### 4.1 Email template (200 words, founder-signed)

> Subject: 30 minutes to shape Tezca's next quarter
>
> Hi {{first_name}},
>
> I'm Aldo, founder of MADFAM and the team building Tezca. I noticed you've been
> using the API meaningfully over the past month ({{call_count}} calls / {{primary_endpoint}}),
> and I'd value 30 minutes of your time to hear how it's actually working for you.
>
> We're forming a small Customer Advisory Board this quarter — 5–15 people, one
> 30-minute conversation each, structured around five short questions about what's
> useful, what's missing, and where Tezca should go next. Your feedback feeds directly
> into our public roadmap.
>
> As a small thank-you, I'll cover a $50 USD coffee or platform credit per session.
>
> If you're open to it, here's my calendar: {{calendly_link}}. Pick any slot the week
> of May 15. I'll bring questions; you bring honest answers.
>
> Thanks for considering it.
>
> — Aldo

### 4.2 Incentive

- $50 USD per completed session, paid as either:
  - Stripe-issued coffee gift card (Starbucks / OXXO / regional equivalent), or
  - Tezca platform credit (preferred — keeps usage flywheel turning).
- No additional compensation for follow-up emails or async questions.

### 4.3 Tooling chain

1. Founder sends invite from personal email (deliverability — bypasses corporate filters).
2. Calendly link routes to a dedicated "Tezca CAB Spring 2026" event type, 30-min slots.
3. **On booking:** Calendly webhook → Coforma creates a `Session` record under
   `cab: tezca-spring-2026`, stamps the Sean Ellis template onto `Session.agendaItems`,
   and creates a `SessionAttendee`.
4. **On booking:** Coforma fires a sibling event into PhyneCRM as
   `engagement.event = "cab_invite_accepted"` (existing PhyneCRM webhook ingest, no new
   surface needed).
5. **On session completion:** Facilitator marks the session `COMPLETED` in Coforma; the
   outbound webhook to Tulana fires automatically (see ADR-003 + `cab-event-webhook.service.ts`).

> **Operator note (v0.1):** the Calendly → Coforma webhook leg is not yet wired.
> For the first cohort the operator will manually create the `Session` rows from the
> seeded CAB. File a follow-up issue to wire Calendly when this becomes painful.

## 5. First cohort timeline

| Date | Action | Owner |
|---|---|---|
| 2026-04-28 | Pull Tezca API user list (≥10 calls / 30d) | Operator |
| 2026-04-29 | Cross-reference with PhyneCRM engaged segment | Operator |
| 2026-04-30 | Founder approves 30-candidate outreach list | Founder |
| 2026-05-01 | First wave of 30 invites sent | Founder |
| 2026-05-08 | Reminder wave to non-responders | Operator |
| 2026-05-15 | First session week begins | Founder |
| 2026-06-15 | Cohort retrospective + Q3 planning | Founder + Operator |

## 6. Privacy & consent

- All outreach is opt-in. Single click `unsubscribe` link in every email.
- Session recordings only with explicit verbal consent at the start of each session.
- Personal data lives in Coforma (RLS-isolated to `madfam-internal` tenant). Aggregated
  PMF score forwarded to Tulana via signed webhook — **no PII** in webhook payload
  (per ADR-003 §"Architectural contract").

## 7. Reversal / escalation criteria

If two consecutive cohorts produce <5 confirmed sessions, treat as a signal that:
- Tezca's active-user base is too thin for a quarterly CAB, OR
- The outreach copy / incentive is misaligned.

In either case, pause Wave PMF-3 execution and revisit RFC 0013 sizing.
