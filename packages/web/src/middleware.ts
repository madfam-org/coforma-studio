import { NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME, sessionSecret, verifySessionToken } from './lib/session-token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for static assets, API routes, and auth routes
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Check for the session cookie (Coforma's own token, see lib/session-token)
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the JWT. Without a secret no session can be trusted, so fail
  // closed (before, the request was let through on a missing secret).
  const key = sessionSecret();
  if (!key) {
    console.error('JANUA_JWT_SECRET is not configured; rejecting the session');
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifySessionToken(sessionCookie.value, key);
    if (!payload) {
      throw new Error('invalid session token');
    }

    // Extract tenant info from the JWT to do tenant-scoped routing.
    // The JWT may contain tenant memberships under `data.user.tenants`
    // or we fall through and let server components handle it.
    const data = (payload.data as Record<string, any>) || payload;
    const user = data.user || data;
    const userTenants: Array<{ slug: string }> = user.tenants || [];

    // Extract tenant slug from URL (first path segment)
    const tenantMatch = pathname.match(/^\/([^/]+)/);
    const tenantSlug = tenantMatch?.[1];

    if (!tenantSlug) {
      return NextResponse.next();
    }

    // If the JWT carries tenant info, enforce access at the edge.
    // If no tenant data in JWT (common with Janua's standard JWT), skip
    // this check and let the server component's Prisma query handle it.
    if (userTenants.length > 0) {
      const hasTenantAccess = userTenants.some(
        (t) => t.slug === tenantSlug
      );

      if (!hasTenantAccess) {
        // Redirect to first available tenant or sign-in
        const firstTenant = userTenants[0];
        if (firstTenant) {
          return NextResponse.redirect(
            new URL(`/${firstTenant.slug}`, request.url)
          );
        }
        return NextResponse.redirect(new URL('/auth/signin', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token -- clear cookie and redirect to login
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
