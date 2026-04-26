/**
 * Server-side auth helpers for App Router API routes.
 *
 * These wrap `getSession()` from `lib/auth.ts` (the canonical Janua-JWT
 * verifier) with the role-checking + tenant-scoping patterns the
 * mutation routes need. Using these instead of inlining the checks per
 * route keeps the `owner|admin`-required guard in one place — bug fixes
 * and policy changes only touch one file.
 *
 * The session shape comes from `lib/auth.ts`:
 *   `session.user.tenants[].role: 'ADMIN' | 'FACILITATOR' | 'MEMBER'`
 *
 * The product currently has no separate `OWNER` role; `ADMIN` is the
 * "full access to tenant settings" tier (see TenantRole enum in
 * packages/api/prisma/schema.prisma) and is what we treat as
 * owner-equivalent.
 */
import { getSession, type AppSession, type SessionUser } from './auth';

export type TenantRole = SessionUser['tenants'][number]['role'];

export interface RequireAuthOk {
  ok: true;
  session: AppSession;
}

export interface RequireAuthErr {
  ok: false;
  status: 401 | 403 | 404;
  reason: string;
}

export type RequireAuthResult = RequireAuthOk | RequireAuthErr;

/**
 * Authenticate the request via Janua session cookie. Returns 401 when
 * no valid session is present.
 */
export async function requireSession(): Promise<RequireAuthResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, reason: 'unauthenticated' };
  }
  return { ok: true, session };
}

/**
 * Authenticate + assert the user has at least one of the given roles in
 * the named tenant. 401 if no session, 403 if session lacks the required
 * tenant-role grant. The caller is responsible for resolving `tenantId`
 * from the route param (usually via the CAB → tenant lookup).
 */
export async function requireTenantRole(
  tenantId: string,
  allowedRoles: readonly TenantRole[],
): Promise<RequireAuthResult> {
  const auth = await requireSession();
  if (!auth.ok) return auth;

  const membership = auth.session.user.tenants.find((t) => t.id === tenantId);
  if (!membership) {
    // Treat "no membership at all" as 403, not 404: don't leak whether
    // the tenant exists to non-members.
    return { ok: false, status: 403, reason: 'not_a_tenant_member' };
  }
  if (!allowedRoles.includes(membership.role)) {
    return { ok: false, status: 403, reason: 'insufficient_role' };
  }
  return auth;
}
