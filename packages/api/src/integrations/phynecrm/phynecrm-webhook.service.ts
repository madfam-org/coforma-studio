/**
 * PhyneCRM inbound webhook handler.
 *
 * Receives `contact.created`, `contact.updated`, `contact.deleted`, and
 * `engagement.status_changed` events from PhyneCRM. The handler is
 * intentionally **operator-promotion-driven**: it does NOT auto-create
 * `CABMembership` rows. Instead it backfills `phynecrmContactId` /
 * `phynecrmEngagementId` on existing memberships (matched by email)
 * and otherwise just records the event for operator review.
 *
 * Why no auto-create: the a16z framework audit (PR #52) calls out that
 * design-partner candidate selection is a founder judgement call. We
 * surface the signal, the operator promotes.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { LoggerService } from '../../lib/logger/logger.service';
import { PrismaService } from '../../lib/prisma/prisma.service';

const SIGNATURE_HEADER = 'madfam-signature';
const SIGNATURE_VERSION = 'v1';
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60; // 5 minutes

export type PhyneCrmEvent =
  | { type: 'contact.created'; data: PhyneCrmContact }
  | { type: 'contact.updated'; data: PhyneCrmContact }
  | { type: 'contact.deleted'; data: { id: string } }
  | {
      type: 'engagement.status_changed';
      data: PhyneCrmEngagementStatus;
    };

export interface PhyneCrmContact {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  tenantId: string;
  externalJanuaId?: string | null;
}

export interface PhyneCrmEngagementStatus {
  engagementId: string;
  contactId: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  tenantId: string;
}

export interface SignatureVerificationResult {
  ok: boolean;
  reason?: 'missing' | 'malformed' | 'expired' | 'mismatch' | 'no_secret';
}

@Injectable()
export class PhyneCrmWebhookService {
  private readonly context = 'PhyneCrmWebhookService';

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify a `madfam-signature: t=<unix>,v1=<hex>` header.
   *
   * Pattern mirrors RouteCraft / cotiza / phyne-crm: 5-min replay
   * window + timing-safe HMAC compare.
   */
  verifySignature(rawBody: string, headerValue: string | undefined): SignatureVerificationResult {
    const secret = this.config.get<string>('PHYNECRM_INBOUND_SECRET');
    if (!secret) {
      this.logger.warn('PHYNECRM_INBOUND_SECRET not configured — rejecting webhook', this.context);
      return { ok: false, reason: 'no_secret' };
    }

    if (!headerValue) {
      return { ok: false, reason: 'missing' };
    }

    const parts = headerValue.split(',').map((p) => p.trim());
    const tsPart = parts.find((p) => p.startsWith('t='));
    const sigPart = parts.find((p) => p.startsWith(`${SIGNATURE_VERSION}=`));
    if (!tsPart || !sigPart) {
      return { ok: false, reason: 'malformed' };
    }

    const ts = Number.parseInt(tsPart.slice(2), 10);
    if (!Number.isFinite(ts)) {
      return { ok: false, reason: 'malformed' };
    }
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) {
      return { ok: false, reason: 'expired' };
    }

    const provided = sigPart.slice(SIGNATURE_VERSION.length + 1);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody}`)
      .digest('hex');

    // Lengths must match for timingSafeEqual; differing lengths is also
    // a mismatch.
    if (provided.length !== expected.length) {
      return { ok: false, reason: 'mismatch' };
    }

    const ok = crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(provided, 'hex')),
      new Uint8Array(Buffer.from(expected, 'hex')),
    );
    return ok ? { ok: true } : { ok: false, reason: 'mismatch' };
  }

  /**
   * Dispatch a verified event to the appropriate handler. Each handler
   * is best-effort — failures are logged and surfaced via the
   * `processed: false` return value, but the route still returns 200
   * so PhyneCRM doesn't retry pathologically.
   */
  async handleEvent(event: PhyneCrmEvent): Promise<{ processed: boolean; note?: string }> {
    switch (event.type) {
      case 'contact.created':
      case 'contact.updated':
        return this.handleContactUpsert(event.data);
      case 'contact.deleted':
        return this.handleContactDeleted(event.data.id);
      case 'engagement.status_changed':
        return this.handleEngagementStatus(event.data);
      default: {
        const exhaustive: never = event;
        this.logger.warn(
          `Unknown PhyneCRM event type: ${(exhaustive as { type?: string }).type ?? 'undefined'}`,
          this.context,
        );
        return { processed: false, note: 'unknown_event_type' };
      }
    }
  }

  private async handleContactUpsert(
    contact: PhyneCrmContact,
  ): Promise<{ processed: boolean; note?: string }> {
    if (!contact.email) {
      return { processed: false, note: 'no_email' };
    }

    // Find membership by email (the user.email is the join key).
    const membership = await this.prisma.cABMembership.findFirst({
      where: {
        user: { email: contact.email },
      },
      select: { id: true, phynecrmContactId: true },
    });

    if (!membership) {
      // No matching membership — log as candidate signal. A future
      // followup can write to a dedicated `cab_candidates` table; for
      // v1 this is operator-driven via logs + dashboard query.
      this.logger.log(
        `PhyneCRM contact ${contact.id} (${contact.email}) observed; no matching CAB membership`,
        this.context,
      );
      return { processed: true, note: 'candidate_observed' };
    }

    if (membership.phynecrmContactId === contact.id) {
      return { processed: true, note: 'already_linked' };
    }

    await this.prisma.cABMembership.update({
      where: { id: membership.id },
      data: { phynecrmContactId: contact.id },
    });
    this.logger.log(
      `Linked PhyneCRM contact ${contact.id} to CABMembership ${membership.id}`,
      this.context,
    );
    return { processed: true, note: 'linked' };
  }

  private async handleContactDeleted(
    contactId: string,
  ): Promise<{ processed: boolean; note?: string }> {
    // Soft-detach: clear the link but don't remove the membership. The
    // operator decides whether to also remove the member from the CAB.
    const result = await this.prisma.cABMembership.updateMany({
      where: { phynecrmContactId: contactId },
      data: { phynecrmContactId: null, phynecrmEngagementId: null },
    });
    return { processed: true, note: `unlinked_${result.count}` };
  }

  private async handleEngagementStatus(
    engagement: PhyneCrmEngagementStatus,
  ): Promise<{ processed: boolean; note?: string }> {
    const result = await this.prisma.cABMembership.updateMany({
      where: { phynecrmContactId: engagement.contactId },
      data: { phynecrmEngagementId: engagement.engagementId },
    });
    if (result.count === 0) {
      return { processed: true, note: 'no_membership_to_link' };
    }
    return { processed: true, note: `engagement_linked_${result.count}` };
  }
}
