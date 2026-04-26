/**
 * PhyneCRM inbound webhook (Next.js port).
 *
 * Mirrors the NestJS implementation in packages/api/src/integrations/phynecrm/
 * for parity, but lives here because production only deploys @coforma/web.
 * The NestJS version stays as the canonical reference + tested implementation;
 * the logic here is intentionally minimal and reuses the same payload shapes.
 *
 * Signature: x-madfam-signature: t=<unix>,v1=<hex>
 * HMAC over `${ts}.${rawBody}`. 5-min replay window.
 * Secret env: PHYNECRM_INBOUND_SECRET.
 */

import * as crypto from 'crypto';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SIGNATURE_HEADER = 'x-madfam-signature';
const MAX_AGE_SECONDS = 5 * 60;

interface PhyneCrmContact {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  tenantId: string;
}

interface PhyneCrmEngagementStatus {
  engagementId: string;
  contactId: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  tenantId: string;
}

type PhyneCrmEvent =
  | { type: 'contact.created'; data: PhyneCrmContact }
  | { type: 'contact.updated'; data: PhyneCrmContact }
  | { type: 'contact.deleted'; data: { id: string } }
  | { type: 'engagement.status_changed'; data: PhyneCrmEngagementStatus };

function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
): { ok: boolean; reason?: string } {
  if (!header) return { ok: false, reason: 'missing' };

  const parts = header.split(',').map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));
  if (!tsPart || !sigPart) return { ok: false, reason: 'malformed' };

  const ts = Number(tsPart.slice(2));
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, reason: 'invalid_timestamp' };

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSeconds > MAX_AGE_SECONDS) return { ok: false, reason: 'expired' };

  const provided = sigPart.slice(3);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');

  if (provided.length !== expected.length) return { ok: false, reason: 'mismatch' };

  const ok = crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(provided, 'hex')),
    new Uint8Array(Buffer.from(expected, 'hex')),
  );
  return ok ? { ok: true } : { ok: false, reason: 'mismatch' };
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.PHYNECRM_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'invalid_signature', reason: 'no_secret' },
      { status: 401 },
    );
  }

  const rawBody = await req.text();
  const sig = verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER), secret);
  if (!sig.ok) {
    return NextResponse.json(
      { error: 'invalid_signature', reason: sig.reason },
      { status: 401 },
    );
  }

  let event: PhyneCrmEvent;
  try {
    event = JSON.parse(rawBody) as PhyneCrmEvent;
  } catch {
    return NextResponse.json({ error: 'malformed_payload' }, { status: 400 });
  }
  if (!event || typeof event !== 'object' || !('type' in event) || !('data' in event)) {
    return NextResponse.json({ error: 'missing_type_or_data' }, { status: 400 });
  }

  // Operator-promotion model: link existing memberships by email; log only
  // for unmatched contacts.
  try {
    switch (event.type) {
      case 'contact.created':
      case 'contact.updated': {
        const data = event.data;
        if (!data.email) {
          return NextResponse.json(
            { received: true, processed: false, note: 'no_email' },
            { status: 200 },
          );
        }
        const membership = await prisma.cABMembership.findFirst({
          where: { user: { email: data.email } },
          select: { id: true, phynecrmContactId: true },
        });
        if (!membership) {
          return NextResponse.json(
            { received: true, processed: true, note: 'candidate_observed' },
            { status: 200 },
          );
        }
        if (membership.phynecrmContactId === data.id) {
          return NextResponse.json(
            { received: true, processed: true, note: 'already_linked' },
            { status: 200 },
          );
        }
        await prisma.cABMembership.update({
          where: { id: membership.id },
          data: { phynecrmContactId: data.id },
        });
        return NextResponse.json(
          { received: true, processed: true, note: 'linked' },
          { status: 200 },
        );
      }
      case 'contact.deleted': {
        const result = await prisma.cABMembership.updateMany({
          where: { phynecrmContactId: event.data.id },
          data: { phynecrmContactId: null, phynecrmEngagementId: null },
        });
        return NextResponse.json(
          { received: true, processed: true, note: `unlinked_${result.count}` },
          { status: 200 },
        );
      }
      case 'engagement.status_changed': {
        const result = await prisma.cABMembership.updateMany({
          where: { phynecrmContactId: event.data.contactId },
          data: { phynecrmEngagementId: event.data.engagementId },
        });
        if (result.count === 0) {
          return NextResponse.json(
            { received: true, processed: true, note: 'no_membership_to_link' },
            { status: 200 },
          );
        }
        return NextResponse.json(
          { received: true, processed: true, note: `engagement_linked_${result.count}` },
          { status: 200 },
        );
      }
      default:
        return NextResponse.json(
          { received: true, processed: false, note: 'unknown_event_type' },
          { status: 200 },
        );
    }
  } catch (err) {
    // Verified payload; never retry-storm. Log + return 200.
    console.error('phynecrm webhook handler error', err);
    return NextResponse.json(
      { received: true, processed: false, note: 'handler_error' },
      { status: 200 },
    );
  }
}
