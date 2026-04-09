/**
 * DEPRECATED: NextAuth.js has been replaced by Janua OIDC.
 *
 * This catch-all route is kept only to handle stale bookmarks or
 * in-flight requests. It redirects everything to the new auth flow.
 * Safe to delete this entire directory once migration is confirmed stable.
 */
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL('/auth/signin', url.origin));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL('/auth/signin', url.origin));
}
