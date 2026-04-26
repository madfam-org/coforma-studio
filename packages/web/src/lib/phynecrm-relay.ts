/**
 * Coforma → PhyneCRM outbound webhook emitter (Next.js port).
 *
 * Mirrors the NestJS implementation in
 *   packages/api/src/integrations/phynecrm/phynecrm-relay.service.ts
 *
 * The NestJS app does NOT deploy in production (no Kustomization in
 * infra/k8s/production/kustomization.yaml + unresolved deps), so any
 * lifecycle event that should reach PhyneCRM has to be emitted from the
 * Next.js side. The inbound webhook was ported in PR #60; this is the
 * matching outbound half.
 *
 * Wire format MUST be byte-identical to the NestJS service so PhyneCRM's
 * shared `validateMadfamSignature` helper accepts both, and so the
 * receiver-side dedupe (keyed off Idempotency-Key) treats retries from
 * either source as the same event:
 *
 *   - Header  x-madfam-signature: t=<unix>,v1=<hex>
 *   - HMAC over `${ts}.${rawBody}` with PHYNECRM_OUTBOUND_SECRET
 *   - Header  idempotency-key: stable per (event-type, entity-id)
 *   - Header  x-coforma-tenant-id: PhyneCRM-side tenant id
 *
 * Fire-and-forget: never throws, returns a structured result for tests
 * + telemetry. Caller is expected to `void`-discard the promise (or
 * await it inside a try/catch belt-and-suspenders) — see callers in
 * packages/web/src/app/api/...
 */

import * as crypto from 'crypto';

const SIGNATURE_HEADER = 'x-madfam-signature';
const IDEMPOTENCY_HEADER = 'idempotency-key';
const TENANT_HEADER = 'x-coforma-tenant-id';

const DEFAULT_TIMEOUT_MS = 5000;

export interface MemberJoinedPayload {
  membershipId: string;
  cabId: string;
  cabSlug: string;
  userEmail: string;
  userName: string | null;
  company: string | null;
  title: string | null;
  /** Set when the member came from PhyneCRM in the first place. */
  phynecrmContactId: string | null;
}

export interface MemberExitedPayload {
  membershipId: string;
  cabId: string;
  exitedAt: string; // ISO 8601
  exitNote: string | null;
  /** When set, PhyneCRM should update the linked contact's lifecycle. */
  phynecrmContactId: string | null;
}

export interface FeedbackCreatedPayload {
  feedbackId: string;
  cabId: string;
  authorEmail: string;
  type: string;
  title: string;
  body: string;
  priority: string | null;
  phynecrmContactId: string | null;
}

export type CoformaOutboundEvent =
  | { type: 'cab.member.joined'; data: MemberJoinedPayload }
  | { type: 'cab.member.exited'; data: MemberExitedPayload }
  | { type: 'cab.feedback.created'; data: FeedbackCreatedPayload };

export type RelayReason =
  | 'disabled'
  | 'missing_tenant'
  | 'fetch_error'
  | 'http_error';

export interface RelayResult {
  ok: boolean;
  status?: number;
  reason?: RelayReason;
}

export interface RelayConfig {
  url: string;
  secret: string;
  timeoutMs: number;
}

/**
 * Resolve relay config from environment. Names match the NestJS service
 * for symmetry with the inbound webhook (PHYNECRM_INBOUND_SECRET) and so
 * a single rotation procedure covers both directions.
 */
export function getRelayConfig(): RelayConfig {
  const timeoutRaw = process.env.PHYNECRM_OUTBOUND_TIMEOUT_MS;
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : NaN;
  return {
    url: process.env.PHYNECRM_OUTBOUND_URL ?? '',
    secret: process.env.PHYNECRM_OUTBOUND_SECRET ?? '',
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

function isEnabled(config: RelayConfig): boolean {
  return Boolean(config.url) && Boolean(config.secret);
}

/**
 * HMAC-SHA256 of `${timestamp}.${body}` with the shared secret.
 * Hex-encoded, lowercase. Identical scheme to the NestJS service so a
 * single `validateMadfamSignature` on the receiver works for both.
 */
function sign(secret: string, timestamp: number, body: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

/**
 * Stable per-event idempotency key. Same event emitted twice (e.g. on
 * a retry, or dual-fire from both NestJS and Next.js sides during a
 * migration) MUST produce the same key so PhyneCRM's receiver dedupes.
 *
 * Keep these strings byte-identical to the NestJS implementation —
 * changing the format silently breaks dedupe across deploys.
 */
export function idempotencyKeyFor(event: CoformaOutboundEvent): string {
  switch (event.type) {
    case 'cab.member.joined':
      return `coforma:cab.member.joined:${event.data.membershipId}`;
    case 'cab.member.exited':
      // exitedAt is part of the key — re-exit (e.g. CHURNED → RENEWED → CHURNED)
      // is a distinct event.
      return `coforma:cab.member.exited:${event.data.membershipId}:${event.data.exitedAt}`;
    case 'cab.feedback.created':
      return `coforma:cab.feedback.created:${event.data.feedbackId}`;
  }
}

/**
 * Fire-and-forget emit. Never throws. Returns the result for tests +
 * telemetry; callers in API routes should `void`-discard.
 *
 * @param tenantId  Coforma tenant resolved to its PhyneCRM-side
 *                  counterpart (Tenant.phynecrmTenantId on the
 *                  Coforma schema). Sent as `x-coforma-tenant-id`.
 *                  Empty string is rejected with `missing_tenant`
 *                  before any network I/O.
 * @param event     Discriminated event union.
 * @param overrides Optional config injection — used by tests. In
 *                  production, omit and let `getRelayConfig()` read
 *                  from process.env.
 */
export async function phynecrmRelay(
  tenantId: string,
  event: CoformaOutboundEvent,
  overrides?: Partial<RelayConfig>,
): Promise<RelayResult> {
  const config = { ...getRelayConfig(), ...(overrides ?? {}) };

  if (!isEnabled(config)) {
    return { ok: false, reason: 'disabled' };
  }
  if (!tenantId) {
    return { ok: false, reason: 'missing_tenant' };
  }

  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(config.secret, timestamp, body);
  const idempotencyKey = idempotencyKeyFor(event);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: `t=${timestamp},v1=${signature}`,
        [IDEMPOTENCY_HEADER]: idempotencyKey,
        [TENANT_HEADER]: tenantId,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      // Verified delivery; non-2xx is a receiver-side issue, not a
      // sender-side bug. Surface it for telemetry but never throw.
      return { ok: false, status: response.status, reason: 'http_error' };
    }
    return { ok: true, status: response.status };
  } catch (err) {
    // Includes AbortError on timeout. Operator-side observability is
    // via Sentry on the calling route — this function stays silent
    // about transport details.
    void err;
    return { ok: false, reason: 'fetch_error' };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Convenience wrappers — calling code doesn't need to construct the
 * union-type wrapper. Mirror the NestJS service surface.
 */
export function emitMemberJoined(
  tenantId: string,
  payload: MemberJoinedPayload,
  overrides?: Partial<RelayConfig>,
): Promise<RelayResult> {
  return phynecrmRelay(tenantId, { type: 'cab.member.joined', data: payload }, overrides);
}

export function emitMemberExited(
  tenantId: string,
  payload: MemberExitedPayload,
  overrides?: Partial<RelayConfig>,
): Promise<RelayResult> {
  return phynecrmRelay(tenantId, { type: 'cab.member.exited', data: payload }, overrides);
}

export function emitFeedbackCreated(
  tenantId: string,
  payload: FeedbackCreatedPayload,
  overrides?: Partial<RelayConfig>,
): Promise<RelayResult> {
  return phynecrmRelay(tenantId, { type: 'cab.feedback.created', data: payload }, overrides);
}
