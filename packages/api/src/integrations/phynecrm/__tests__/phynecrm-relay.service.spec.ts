/**
 * Tests for PhyneCRM outbound relay.
 *
 * Cover:
 * - Disabled when env not set (returns reason: disabled, no fetch)
 * - Missing tenant rejected before fetch
 * - Signature header has the t=…,v1=… shape
 * - Idempotency-Key is stable per (event-type, entity-id)
 * - Network timeout / abort doesn't throw, returns fetch_error
 * - Non-2xx response returns http_error with status
 */

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoggerService } from '../../../lib/logger/logger.service';
import { PhyneCrmRelayService, type MemberJoinedPayload } from '../phynecrm-relay.service';

const URL = 'https://crm.madfam.io/api/v1/webhooks/coforma';
const SECRET = 'test-secret';

function makeService(opts: {
  url?: string;
  secret?: string;
  timeoutMs?: number;
} = {}): PhyneCrmRelayService {
  const config = {
    get: <T>(key: string, fallback?: T): T | undefined => {
      switch (key) {
        case 'PHYNECRM_OUTBOUND_URL':
          return (opts.url ?? URL) as unknown as T;
        case 'PHYNECRM_OUTBOUND_SECRET':
          return (opts.secret ?? SECRET) as unknown as T;
        case 'PHYNECRM_OUTBOUND_TIMEOUT_MS':
          return (opts.timeoutMs ?? 5000) as unknown as T;
        default:
          return fallback;
      }
    },
  } as unknown as ConfigService;
  const logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    verbose: () => undefined,
  } as unknown as LoggerService;
  return new PhyneCrmRelayService(config, logger);
}

const PAYLOAD: MemberJoinedPayload = {
  membershipId: 'mem-1',
  cabId: 'cab-1',
  cabSlug: 'tezca-spring',
  userEmail: 'a@b.com',
  userName: 'A B',
  company: 'Acme',
  title: 'CTO',
  phynecrmContactId: null,
};

describe('PhyneCrmRelayService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports disabled when URL is missing', async () => {
    const service = makeService({ url: '' });
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result).toEqual({ ok: false, reason: 'disabled' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('reports disabled when secret is missing', async () => {
    const service = makeService({ secret: '' });
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  it('rejects when tenantId is empty (no fetch)', async () => {
    const service = makeService();
    const result = await service.emitMemberJoined('', PAYLOAD);
    expect(result).toEqual({ ok: false, reason: 'missing_tenant' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('signs the request and forwards tenant header', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    const service = makeService();
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result.ok).toBe(true);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [requestUrl, options] = call as [string, RequestInit & { headers: Record<string, string> }];
    expect(requestUrl).toBe(URL);
    expect(options.method).toBe('POST');
    expect(options.headers['x-coforma-tenant-id']).toBe('tenant-1');

    // Signature shape
    const sig = options.headers['madfam-signature'];
    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    // Verify HMAC with the same secret round-trips
    const [tsPart, sigPart] = sig.split(',');
    const ts = Number(tsPart.slice(2));
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${ts}.${options.body as string}`)
      .digest('hex');
    expect(sigPart.slice(3)).toBe(expected);
  });

  it('uses stable Idempotency-Key per membership for member.joined', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const service = makeService();
    await service.emitMemberJoined('tenant-1', PAYLOAD);
    await service.emitMemberJoined('tenant-1', PAYLOAD);
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const k1 = (calls[0][1] as { headers: Record<string, string> }).headers['idempotency-key'];
    const k2 = (calls[1][1] as { headers: Record<string, string> }).headers['idempotency-key'];
    expect(k1).toBe(k2);
    expect(k1).toBe('coforma:cab.member.joined:mem-1');
  });

  it('member.exited idempotency key includes exitedAt (re-exit is distinct)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const service = makeService();
    await service.emitMemberExited('tenant-1', {
      membershipId: 'mem-2',
      cabId: 'cab-1',
      exitedAt: '2026-04-01T00:00:00Z',
      exitNote: null,
      phynecrmContactId: null,
    });
    await service.emitMemberExited('tenant-1', {
      membershipId: 'mem-2',
      cabId: 'cab-1',
      exitedAt: '2026-04-15T00:00:00Z', // re-exit later
      exitNote: null,
      phynecrmContactId: null,
    });
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const k1 = (calls[0][1] as { headers: Record<string, string> }).headers['idempotency-key'];
    const k2 = (calls[1][1] as { headers: Record<string, string> }).headers['idempotency-key'];
    expect(k1).not.toBe(k2);
  });

  it('returns http_error on non-2xx, never throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('upstream blew up', { status: 503 }),
    );
    const service = makeService();
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result).toEqual({ ok: false, status: 503, reason: 'http_error' });
  });

  it('returns fetch_error on network failure, never throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNRESET'));
    const service = makeService();
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result).toEqual({ ok: false, reason: 'fetch_error' });
  });

  it('aborts request after timeoutMs (returns fetch_error, never throws)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const service = makeService({ timeoutMs: 20 });
    const result = await service.emitMemberJoined('tenant-1', PAYLOAD);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('fetch_error');
  });
});
