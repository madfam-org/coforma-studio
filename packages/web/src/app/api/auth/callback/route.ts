import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionSecret,
  signSessionToken,
} from '@/lib/session-token';

const prisma = new PrismaClient();

/**
 * Handle the OIDC authorization code callback from Janua.
 *
 * Flow:
 * 1. Exchange the authorization code for tokens at Janua's token endpoint
 * 2. Extract user info from the ID token or userinfo endpoint
 * 3. Upsert the user in the local database
 * 4. Load tenant memberships
 * 5. Create Coforma's own HS256 session JWT cookie (user + tenants); see
 *    `lib/session-token.ts`. It is not a Janua token.
 * 6. Redirect to the app
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const errorUrl = new URL('/auth/error', request.url);
    errorUrl.searchParams.set('error', error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?error=MissingCode', request.url));
  }

  // Refuse to start a session that could not be signed safely (an empty HMAC
  // key would make the cookie forgeable).
  const sessionKey = sessionSecret();
  if (!sessionKey) {
    console.error('JANUA_JWT_SECRET is not configured; refusing to create a session');
    return NextResponse.redirect(new URL('/auth/error?error=Configuration', request.url));
  }

  const issuerUrl = process.env.JANUA_ISSUER_URL!;
  const clientId = process.env.JANUA_CLIENT_ID!;
  const clientSecret = process.env.JANUA_CLIENT_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${appUrl}/api/auth/callback`;

  try {
    // Step 1: Exchange authorization code for tokens
    const tokenResponse = await fetch(`${issuerUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      return NextResponse.redirect(new URL('/auth/error?error=TokenExchange', request.url));
    }

    const tokens = await tokenResponse.json();

    // Step 2: Get user info from the userinfo endpoint
    const userinfoResponse = await fetch(`${issuerUrl}/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      console.error('Userinfo request failed:', userinfoResponse.status);
      return NextResponse.redirect(new URL('/auth/error?error=UserInfo', request.url));
    }

    const userinfo = await userinfoResponse.json();

    // Step 3: Upsert the user in our database
    const user = await prisma.user.upsert({
      where: { email: userinfo.email },
      update: {
        name: userinfo.name || [userinfo.given_name, userinfo.family_name].filter(Boolean).join(' ') || undefined,
        image: userinfo.picture || undefined,
      },
      create: {
        id: userinfo.sub,
        email: userinfo.email,
        name: userinfo.name || [userinfo.given_name, userinfo.family_name].filter(Boolean).join(' ') || null,
        image: userinfo.picture || null,
      },
    });

    // Step 4: Load tenant memberships
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            logo: true,
            brandColor: true,
          },
        },
      },
    });

    const tenants = memberships.map((m) => ({
      id: m.tenant.id,
      slug: m.tenant.slug,
      name: m.tenant.name,
      logo: m.tenant.logo,
      brandColor: m.tenant.brandColor,
      role: m.role,
    }));

    // Step 5: Create Coforma's session JWT (HS256, see lib/session-token)
    const sessionJwt = await signSessionToken(
      {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            tenants,
          },
        },
      },
      user.id,
      sessionKey,
    );

    // Step 6: Set cookie and redirect
    // Determine where to redirect: use state param, first tenant, or home
    let redirectTo = '/';
    if (state && state.startsWith('/')) {
      redirectTo = state;
    } else {
      const firstTenant = tenants[0];
      if (firstTenant) redirectTo = `/${firstTenant.slug}`;
    }

    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set(SESSION_COOKIE_NAME, sessionJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err) {
    console.error('OIDC callback error:', err);
    return NextResponse.redirect(new URL('/auth/error?error=Callback', request.url));
  }
}
