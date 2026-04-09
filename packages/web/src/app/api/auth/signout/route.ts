import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'janua_session';

/**
 * API route to clear the Janua session cookie.
 * Called by client-side sign-out to ensure the cookie is deleted
 * before redirecting to Janua's logout endpoint.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
