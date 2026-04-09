import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Janua configuration from environment variables
export const januaConfig = {
  clientId: process.env.JANUA_CLIENT_ID!,
  clientSecret: process.env.JANUA_CLIENT_SECRET!,
  issuerUrl: process.env.JANUA_ISSUER_URL!,
  jwtSecret: process.env.JANUA_JWT_SECRET!,
};

const COOKIE_NAME = 'janua_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tenants: Array<{
    id: string;
    slug: string;
    name: string;
    logo: string | null;
    brandColor: string | null;
    role: 'ADMIN' | 'FACILITATOR' | 'MEMBER';
  }>;
}

export interface AppSession {
  user: SessionUser;
}

/**
 * Server-side session verification.
 * Reads the Janua session cookie, verifies the JWT with jose,
 * then enriches with tenant memberships from Prisma.
 */
export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(januaConfig.jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    // Extract user info from JWT payload.
    // The JWT may nest user data under a `data` claim (Janua server client format)
    // or use standard OIDC claims at the top level.
    const data = (payload.data as Record<string, any>) || payload;
    const user = data.user || data;

    const userId = user.id || payload.sub;
    const email = user.email || (payload.email as string);
    const name = user.name || user.first_name
      ? [user.first_name, user.last_name].filter(Boolean).join(' ') || null
      : null;
    const image = user.image || user.profile_image_url || null;

    if (!userId || !email) {
      return null;
    }

    // Look up tenant memberships from the database
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId },
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
      role: m.role as 'ADMIN' | 'FACILITATOR' | 'MEMBER',
    }));

    return {
      user: {
        id: userId,
        email,
        name,
        image,
        tenants,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Build the Janua OIDC authorization URL for login.
 */
export function getJanuaLoginUrl(redirectUri: string, state?: string): string {
  const url = new URL(`${januaConfig.issuerUrl}/authorize`);
  url.searchParams.set('client_id', januaConfig.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

/**
 * Build the Janua OIDC registration URL.
 */
export function getJanuaSignupUrl(redirectUri: string, state?: string): string {
  const url = new URL(`${januaConfig.issuerUrl}/register`);
  url.searchParams.set('client_id', januaConfig.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

/**
 * Build the Janua logout URL.
 */
export function getJanuaLogoutUrl(postLogoutRedirectUri?: string): string {
  const url = new URL(`${januaConfig.issuerUrl}/logout`);
  url.searchParams.set('client_id', januaConfig.clientId);
  if (postLogoutRedirectUri) {
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  }
  return url.toString();
}
