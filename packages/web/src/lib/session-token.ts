/**
 * Coforma's own session token (the `janua_session` cookie).
 *
 * This is NOT a Janua-issued token. After the Janua OIDC code exchange in
 * `app/api/auth/callback/route.ts`, Coforma calls Janua's userinfo endpoint
 * server-side and then mints this cookie itself, signed with HS256 and the
 * Coforma-held secret `JANUA_JWT_SECRET` (the name is historical: Janua never
 * sees or issues this secret). Janua access and ID tokens are never verified
 * locally, so Janua's JWKS / RS256 contract does not apply here.
 *
 * Every mint and verify goes through this module so that:
 * - the algorithm is fixed to HS256 and never taken from the token header;
 * - `exp` and `sub` are required;
 * - a missing or empty secret fails closed. jose 5 signs and verifies with a
 *   zero-length HMAC key, so without this check an unset secret would make
 *   every session cookie forgeable.
 *
 * Only `jose` is imported, so the middleware (Edge runtime) can use it too.
 */
import { jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';

export const SESSION_COOKIE_NAME = 'janua_session';
export const SESSION_ALGORITHM = 'HS256';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const REQUIRED_CLAIMS = ['exp', 'sub'];
const RECOMMENDED_MIN_SECRET_BYTES = 32;

let shortSecretWarned = false;

/**
 * The HMAC key for session tokens, or `null` when `JANUA_JWT_SECRET` is unset
 * or empty. Callers must treat `null` as "no session can be minted or
 * trusted".
 */
export function sessionSecret(
  raw: string | undefined = process.env.JANUA_JWT_SECRET
): Uint8Array | null {
  if (!raw) return null;
  const key = new TextEncoder().encode(raw);
  if (key.length < RECOMMENDED_MIN_SECRET_BYTES && !shortSecretWarned) {
    shortSecretWarned = true;
    console.warn(
      `JANUA_JWT_SECRET is ${key.length} bytes; use at least ${RECOMMENDED_MIN_SECRET_BYTES} (e.g. \`openssl rand -hex 32\`).`
    );
  }
  return key;
}

/** Verify a session token. Returns the payload, or `null` on any failure. */
export async function verifySessionToken(
  token: string,
  key: Uint8Array | null = sessionSecret()
): Promise<JWTPayload | null> {
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [SESSION_ALGORITHM],
      requiredClaims: REQUIRED_CLAIMS,
    });
    return payload;
  } catch {
    return null;
  }
}

/** Mint a session token. Throws when the secret is not configured. */
export async function signSessionToken(
  claims: JWTPayload,
  subject: string,
  key: Uint8Array | null = sessionSecret()
): Promise<string> {
  if (!key) {
    throw new Error(
      'JANUA_JWT_SECRET is not configured; refusing to mint a session token'
    );
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
}
