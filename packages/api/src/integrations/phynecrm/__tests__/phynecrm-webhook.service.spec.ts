/**
 * Tests for PhyneCRM inbound webhook signature verification.
 *
 * Signature failures MUST be rejected before any business logic runs —
 * mismatched, expired, malformed, and missing-secret cases all need
 * coverage.
 */

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import { LoggerService } from '../../../lib/logger/logger.service';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { PhyneCrmWebhookService } from '../phynecrm-webhook.service';

const TEST_SECRET = 'test-secret-for-hmac-only-not-real-key';

// `secret` is required so callers must explicitly pass undefined to
// exercise the no-secret branch (avoids the default-parameter trap
// where passing `undefined` falls back to the default).
function makeService(secret: string | undefined): PhyneCrmWebhookService {
  const config = {
    get: (key: string) => (key === 'PHYNECRM_INBOUND_SECRET' ? secret : undefined),
  } as unknown as ConfigService;
  const logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    verbose: () => undefined,
  } as unknown as LoggerService;
  const prisma = {} as PrismaService; // signature tests don't touch DB
  return new PhyneCrmWebhookService(config, logger, prisma);
}

function signBody(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('PhyneCrmWebhookService.verifySignature', () => {
  const body = JSON.stringify({ type: 'contact.created', data: { id: 'c_1', email: 'a@b.com' } });

  it('accepts a valid signature', () => {
    const service = makeService(TEST_SECRET);
    const header = signBody(body, TEST_SECRET);
    const result = service.verifySignature(body, header);
    expect(result.ok).toBe(true);
  });

  it('rejects when header is missing', () => {
    const service = makeService(TEST_SECRET);
    const result = service.verifySignature(body, undefined);
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects malformed header (no parts)', () => {
    const service = makeService(TEST_SECRET);
    const result = service.verifySignature(body, 'garbage');
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects malformed header (missing v1=)', () => {
    const service = makeService(TEST_SECRET);
    const result = service.verifySignature(body, 't=1700000000,sig=abc');
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects when timestamp is too old (>5 min)', () => {
    const service = makeService(TEST_SECRET);
    const oldTs = Math.floor(Date.now() / 1000) - 60 * 6; // 6 minutes ago
    const header = signBody(body, TEST_SECRET, oldTs);
    const result = service.verifySignature(body, header);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects when signature is computed against a different body', () => {
    const service = makeService(TEST_SECRET);
    const header = signBody('different body', TEST_SECRET);
    const result = service.verifySignature(body, header);
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects when computed against a different secret', () => {
    const service = makeService(TEST_SECRET);
    const header = signBody(body, 'wrong-secret');
    const result = service.verifySignature(body, header);
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects when configured secret is missing', () => {
    const service = makeService(undefined);
    const header = signBody(body, TEST_SECRET);
    const result = service.verifySignature(body, header);
    expect(result).toEqual({ ok: false, reason: 'no_secret' });
  });

  it('rejects when signature length differs from expected', () => {
    const service = makeService(TEST_SECRET);
    const ts = Math.floor(Date.now() / 1000);
    // Truncated signature
    const result = service.verifySignature(body, `t=${ts},v1=abcd`);
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });
});
