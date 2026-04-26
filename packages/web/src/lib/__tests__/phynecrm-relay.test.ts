/**
 * Tests for the Next.js port of the PhyneCRM outbound relay.
 *
 * Parity contract with packages/api/src/integrations/phynecrm/__tests__/
 * phynecrm-relay.service.spec.ts:
 *   - Disabled when env not set (no fetch)
 *   - Missing tenant rejected before fetch
 *   - Signature header has the t=…,v1=… shape and is HMAC-SHA256-byte-
 *     identical to the NestJS service
 *   - Idempotency-Key is stable per (event-type, entity-id) and matches
 *     the NestJS string format byte-for-byte
 *   - Network timeout / abort returns fetch_error, never throws
 *   - Non-2xx returns http_error with status, never throws
 */

import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emitMemberExited,
  emitMemberJoined,
  idempotencyKeyFor,
  phynecrmRelay,
  type MemberJoinedPayload,
} from '../phynecrm-relay';

const URL_OK = 'https://crm.madfam.io/api/v1/webhooks/coforma';
const SECRET = 'test-secret';

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

type FetchMock = ReturnType<typeof vi.fn>;
type CapturedInit = RequestInit & { headers: Record<string, string> };

function readHeaders(call: unknown[] | undefined): Record<string, string> {
  if (!call) throw new Error('expected fetch call but got none');
  return (call[1] as CapturedInit).headers;
}

function getCall(calls: unknown[][], idx: number): unknown[] {
  const c = calls[idx];
  if (!c) throw new Error(`expected fetch call at index ${idx}`);
  return c;
}

describe('phynecrmRelay', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports disabled when URL is empty (no fetch)', async () => {
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: '',
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: 'disabled' });
    expect(globalThis.fetch as FetchMock).not.toHaveBeenCalled();
  });

  it('reports disabled when secret is empty (no fetch)', async () => {
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: URL_OK,
      secret: '',
    });
    expect(result).toEqual({ ok: false, reason: 'disabled' });
    expect(globalThis.fetch as FetchMock).not.toHaveBeenCalled();
  });

  it('rejects when tenantId is empty (no fetch, no signature work)', async () => {
    const result = await emitMemberJoined('', PAYLOAD, {
      url: URL_OK,
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: 'missing_tenant' });
    expect(globalThis.fetch as FetchMock).not.toHaveBeenCalled();
  });

  it('signs request with HMAC-SHA256 over `${ts}.${body}` and forwards headers', async () => {
    (globalThis.fetch as FetchMock).mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: URL_OK,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);

    const call = getCall((globalThis.fetch as FetchMock).mock.calls, 0);
    const [requestUrl, init] = call as [string, CapturedInit];
    expect(requestUrl).toBe(URL_OK);
    expect(init.method).toBe('POST');

    const headers = readHeaders(call);
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-coforma-tenant-id']).toBe('tenant-1');
    expect(headers['idempotency-key']).toBe('coforma:cab.member.joined:mem-1');

    const sig = headers['x-madfam-signature'];
    expect(sig).toBeDefined();
    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    // Byte-identical to NestJS: HMAC-SHA256 over `${ts}.${rawBody}` hex.
    const parts = (sig as string).split(',');
    const tsPart = parts[0] as string;
    const sigPart = parts[1] as string;
    const ts = Number(tsPart.slice(2));
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${ts}.${init.body as string}`)
      .digest('hex');
    expect(sigPart.slice(3)).toBe(expected);
  });

  it('uses stable Idempotency-Key per membership for cab.member.joined', async () => {
    (globalThis.fetch as FetchMock).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    await emitMemberJoined('tenant-1', PAYLOAD, { url: URL_OK, secret: SECRET });
    await emitMemberJoined('tenant-1', PAYLOAD, { url: URL_OK, secret: SECRET });
    const calls = (globalThis.fetch as FetchMock).mock.calls;
    const k1 = readHeaders(getCall(calls, 0))['idempotency-key'];
    const k2 = readHeaders(getCall(calls, 1))['idempotency-key'];
    expect(k1).toBe(k2);
    expect(k1).toBe('coforma:cab.member.joined:mem-1');
  });

  it('cab.member.exited idempotency key includes exitedAt (re-exit is distinct)', async () => {
    (globalThis.fetch as FetchMock).mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    await emitMemberExited(
      'tenant-1',
      {
        membershipId: 'mem-2',
        cabId: 'cab-1',
        exitedAt: '2026-04-01T00:00:00Z',
        exitNote: null,
        phynecrmContactId: null,
      },
      { url: URL_OK, secret: SECRET },
    );
    await emitMemberExited(
      'tenant-1',
      {
        membershipId: 'mem-2',
        cabId: 'cab-1',
        exitedAt: '2026-04-15T00:00:00Z',
        exitNote: null,
        phynecrmContactId: null,
      },
      { url: URL_OK, secret: SECRET },
    );
    const calls = (globalThis.fetch as FetchMock).mock.calls;
    const k1 = readHeaders(getCall(calls, 0))['idempotency-key'];
    const k2 = readHeaders(getCall(calls, 1))['idempotency-key'];
    expect(k1).not.toBe(k2);
    expect(k1).toBe('coforma:cab.member.exited:mem-2:2026-04-01T00:00:00Z');
    expect(k2).toBe('coforma:cab.member.exited:mem-2:2026-04-15T00:00:00Z');
  });

  it('returns http_error on non-2xx, never throws', async () => {
    (globalThis.fetch as FetchMock).mockResolvedValueOnce(
      new Response('upstream blew up', { status: 503 }),
    );
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: URL_OK,
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, status: 503, reason: 'http_error' });
  });

  it('returns fetch_error on network failure, never throws', async () => {
    (globalThis.fetch as FetchMock).mockRejectedValueOnce(new Error('ECONNRESET'));
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: URL_OK,
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: 'fetch_error' });
  });

  it('aborts request after timeoutMs and returns fetch_error (never throws)', async () => {
    (globalThis.fetch as FetchMock).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const result = await emitMemberJoined('tenant-1', PAYLOAD, {
      url: URL_OK,
      secret: SECRET,
      timeoutMs: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('fetch_error');
  });

  it('idempotencyKeyFor produces NestJS-byte-identical strings (regression guard)', () => {
    expect(
      idempotencyKeyFor({ type: 'cab.member.joined', data: PAYLOAD }),
    ).toBe('coforma:cab.member.joined:mem-1');
    expect(
      idempotencyKeyFor({
        type: 'cab.member.exited',
        data: {
          membershipId: 'mem-9',
          cabId: 'cab-9',
          exitedAt: '2026-05-01T00:00:00Z',
          exitNote: null,
          phynecrmContactId: null,
        },
      }),
    ).toBe('coforma:cab.member.exited:mem-9:2026-05-01T00:00:00Z');
    expect(
      idempotencyKeyFor({
        type: 'cab.feedback.created',
        data: {
          feedbackId: 'fb-3',
          cabId: 'cab-1',
          authorEmail: 'x@y.com',
          type: 'BUG',
          title: 't',
          body: 'b',
          priority: null,
          phynecrmContactId: null,
        },
      }),
    ).toBe('coforma:cab.feedback.created:fb-3');
  });

  it('phynecrmRelay reads config from process.env when no overrides given', async () => {
    const prevUrl = process.env.PHYNECRM_OUTBOUND_URL;
    const prevSecret = process.env.PHYNECRM_OUTBOUND_SECRET;
    process.env.PHYNECRM_OUTBOUND_URL = URL_OK;
    process.env.PHYNECRM_OUTBOUND_SECRET = SECRET;
    try {
      (globalThis.fetch as FetchMock).mockResolvedValueOnce(
        new Response(null, { status: 200 }),
      );
      const result = await phynecrmRelay('tenant-7', {
        type: 'cab.member.joined',
        data: PAYLOAD,
      });
      expect(result.ok).toBe(true);
      const headers = readHeaders(getCall((globalThis.fetch as FetchMock).mock.calls, 0));
      expect(headers['x-coforma-tenant-id']).toBe('tenant-7');
    } finally {
      if (prevUrl === undefined) delete process.env.PHYNECRM_OUTBOUND_URL;
      else process.env.PHYNECRM_OUTBOUND_URL = prevUrl;
      if (prevSecret === undefined) delete process.env.PHYNECRM_OUTBOUND_SECRET;
      else process.env.PHYNECRM_OUTBOUND_SECRET = prevSecret;
    }
  });
});
