/**
 * Tests for Coforma's own session token (`janua_session`), lib/session-token.ts,
 * and the middleware's handling of it.
 */
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '../../middleware';
import {
  SESSION_ALGORITHM,
  SESSION_COOKIE_NAME,
  sessionSecret,
  signSessionToken,
  verifySessionToken,
} from '../session-token';

const SECRET = 'test-session-secret-0123456789abcdef0123456789';
const key = new TextEncoder().encode(SECRET);

function rawToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  const b64 = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64(header)}.${b64(payload)}.`;
}

async function signed(
  alg: string,
  { sub = 'user-1', exp = '1h' as string | null, signer = key } = {}
): Promise<string> {
  const jwt = new SignJWT({
    data: { user: { id: 'user-1', email: 'a@example.test' } },
  })
    .setProtectedHeader({ alg })
    .setIssuedAt();
  if (sub) jwt.setSubject(sub);
  if (exp) jwt.setExpirationTime(exp);
  return jwt.sign(signer);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session secret', () => {
  it('is null when JANUA_JWT_SECRET is unset or empty', () => {
    expect(sessionSecret(undefined)).toBeNull();
    expect(sessionSecret('')).toBeNull();
  });

  it('encodes a configured secret', () => {
    expect(sessionSecret(SECRET)).toEqual(key);
  });
});

describe('session token', () => {
  it('round-trips with HS256, sub and exp', async () => {
    const token = await signSessionToken(
      { data: { user: { id: 'user-1' } } },
      'user-1',
      key
    );
    expect(
      JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString()).alg
    ).toBe(SESSION_ALGORITHM);
    const payload = await verifySessionToken(token, key);
    expect(payload?.sub).toBe('user-1');
    expect(typeof payload?.exp).toBe('number');
  });

  it('refuses to mint or trust anything without a secret', async () => {
    await expect(signSessionToken({}, 'user-1', null)).rejects.toThrow(
      /not configured/
    );
    const forged = await signed('HS256', { signer: new Uint8Array(0) });
    expect(await verifySessionToken(forged, null)).toBeNull();
    expect(
      await verifySessionToken(forged, sessionSecret(undefined))
    ).toBeNull();
  });

  it('rejects an algorithm other than HS256, even with the right secret', async () => {
    expect(await verifySessionToken(await signed('HS512'), key)).toBeNull();
    expect(await verifySessionToken(await signed('HS384'), key)).toBeNull();
  });

  it('rejects alg none', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = rawToken({ alg: 'none' }, { sub: 'user-1', exp: now + 3600 });
    expect(await verifySessionToken(token, key)).toBeNull();
  });

  it('rejects a token without exp or without sub', async () => {
    expect(
      await verifySessionToken(await signed('HS256', { exp: null }), key)
    ).toBeNull();
    expect(
      await verifySessionToken(await signed('HS256', { sub: '' }), key)
    ).toBeNull();
  });

  it('rejects an expired token and one signed with another secret', async () => {
    expect(
      await verifySessionToken(await signed('HS256', { exp: '-1m' }), key)
    ).toBeNull();
    const other = new TextEncoder().encode(
      'another-secret-0123456789abcdef0123456789'
    );
    expect(
      await verifySessionToken(await signed('HS256', { signer: other }), key)
    ).toBeNull();
  });
});

describe('middleware', () => {
  function request(token: string): NextRequest {
    return new NextRequest('http://localhost/acme/dashboard', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
  }

  it('fails closed when JANUA_JWT_SECRET is unset', async () => {
    vi.stubEnv('JANUA_JWT_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const forged = await signed('HS256', { signer: new Uint8Array(0) });
    const response = await middleware(request(forged));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
    errorSpy.mockRestore();
  });

  it('lets a valid session through', async () => {
    vi.stubEnv('JANUA_JWT_SECRET', SECRET);
    const response = await middleware(request(await signed('HS256')));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects and clears the cookie on an HS512 token', async () => {
    vi.stubEnv('JANUA_JWT_SECRET', SECRET);
    const response = await middleware(request(await signed('HS512')));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
  });
});
