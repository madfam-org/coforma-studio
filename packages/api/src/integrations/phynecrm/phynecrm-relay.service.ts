/**
 * Coforma → PhyneCRM outbound webhook emitter.
 *
 * Fires signed webhook events to PhyneCRM when CAB membership lifecycle
 * or feedback events happen in Coforma. Mirrors the inbound shape so
 * PhyneCRM can verify with the same `madfam-signature: t=<unix>,v1=<hex>`
 * convention.
 *
 * Fire-and-forget by design: any failure is logged but never throws into
 * the calling code path (CABMembership creation, feedback ingestion, etc.).
 * The calling code uses `Promise.allSettled`-style isolation.
 *
 * Idempotency: each emission carries a stable `Idempotency-Key` derived
 * from event type + entity ID, so retries / dual-fire don't create
 * duplicates downstream.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { LoggerService } from '../../lib/logger/logger.service';

const SIGNATURE_HEADER = 'madfam-signature';
const IDEMPOTENCY_HEADER = 'idempotency-key';
const TENANT_HEADER = 'x-coforma-tenant-id';

export type CoformaOutboundEvent =
  | {
      type: 'cab.member.joined';
      data: MemberJoinedPayload;
    }
  | {
      type: 'cab.member.exited';
      data: MemberExitedPayload;
    }
  | {
      type: 'cab.feedback.created';
      data: FeedbackCreatedPayload;
    };

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
  type: string; // FeedbackType enum value
  title: string;
  body: string;
  priority: string | null;
  phynecrmContactId: string | null;
}

export interface RelayResult {
  ok: boolean;
  status?: number;
  reason?: 'disabled' | 'missing_tenant' | 'fetch_error' | 'http_error';
}

@Injectable()
export class PhyneCrmRelayService {
  private readonly context = 'PhyneCrmRelayService';
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  private readonly timeoutMs: number;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.webhookUrl = this.config.get<string>('PHYNECRM_OUTBOUND_URL', '');
    this.webhookSecret = this.config.get<string>('PHYNECRM_OUTBOUND_SECRET', '');
    this.timeoutMs = this.config.get<number>('PHYNECRM_OUTBOUND_TIMEOUT_MS', 5000);
    this.enabled = !!this.webhookUrl && !!this.webhookSecret;

    if (this.enabled) {
      this.logger.log(`PhyneCRM relay initialized -> ${this.webhookUrl}`, this.context);
    } else {
      this.logger.warn(
        'PhyneCRM relay disabled: PHYNECRM_OUTBOUND_URL or PHYNECRM_OUTBOUND_SECRET not set',
        this.context,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Fire-and-forget emit. Returns the result for tests + telemetry but
   * NEVER throws — callers should not need a try/catch.
   *
   * @param tenantId  The Coforma tenant the event belongs to. Sent as
   *                  `x-coforma-tenant-id` so PhyneCRM can resolve to its
   *                  own tenant via the Tenant.phynecrmTenantId mapping.
   */
  async emit(tenantId: string, event: CoformaOutboundEvent): Promise<RelayResult> {
    if (!this.enabled) {
      return { ok: false, reason: 'disabled' };
    }
    if (!tenantId) {
      this.logger.warn(`Skipping ${event.type} emit: missing tenantId`, this.context);
      return { ok: false, reason: 'missing_tenant' };
    }

    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.sign(timestamp, body);
    const idempotencyKey = this.idempotencyKeyFor(event);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.webhookUrl, {
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
          this.logger.warn(
            `PhyneCRM relay non-2xx for ${event.type}: ${response.status}`,
            this.context,
          );
          return { ok: false, status: response.status, reason: 'http_error' };
        }
        return { ok: true, status: response.status };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      // Includes AbortError on timeout.
      this.logger.error(
        `PhyneCRM relay failed for ${event.type}: ${(err as Error).message}`,
        this.context,
      );
      return { ok: false, reason: 'fetch_error' };
    }
  }

  /**
   * Convenience helpers — the calling service doesn't need to construct
   * the union-type wrapper.
   */
  emitMemberJoined(tenantId: string, payload: MemberJoinedPayload): Promise<RelayResult> {
    return this.emit(tenantId, { type: 'cab.member.joined', data: payload });
  }

  emitMemberExited(tenantId: string, payload: MemberExitedPayload): Promise<RelayResult> {
    return this.emit(tenantId, { type: 'cab.member.exited', data: payload });
  }

  emitFeedbackCreated(tenantId: string, payload: FeedbackCreatedPayload): Promise<RelayResult> {
    return this.emit(tenantId, { type: 'cab.feedback.created', data: payload });
  }

  private sign(timestamp: number, body: string): string {
    return crypto.createHmac('sha256', this.webhookSecret).update(`${timestamp}.${body}`).digest('hex');
  }

  /**
   * Stable per-event idempotency key. Same event emitted twice (e.g. on
   * a retry) must produce the same key so PhyneCRM can dedup.
   */
  private idempotencyKeyFor(event: CoformaOutboundEvent): string {
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
}
