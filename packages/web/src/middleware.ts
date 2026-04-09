import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'janua_session';

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

  // Check for the Janua session cookie
  const sessionCookie = request.cookies.get(COOKIE_NAME);

  if (!sessionCookie) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the JWT
  const jwtSecret = process.env.JANUA_JWT_SECRET;
  if (!jwtSecret) {
    // Misconfiguration -- let the request through and let the server-side
    // session check handle the error gracefully.
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

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
        if (userTenants.length > 0) {
          return NextResponse.redirect(
            new URL(`/${userTenants[0].slug}`, request.url)
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
    response.cookies.delete(COOKIE_NAME);
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
