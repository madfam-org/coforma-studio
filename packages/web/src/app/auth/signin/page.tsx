'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

const JANUA_ISSUER_URL = process.env.NEXT_PUBLIC_JANUA_ISSUER_URL || '';
const JANUA_CLIENT_ID = process.env.NEXT_PUBLIC_JANUA_CLIENT_ID || '';

function buildJanuaLoginUrl(callbackUrl: string): string {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectUri = `${appUrl}/api/auth/callback`;

  const url = new URL(`${JANUA_ISSUER_URL}/authorize`);
  url.searchParams.set('client_id', JANUA_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  // Pass the intended destination as state so the callback can redirect there
  url.searchParams.set('state', callbackUrl);
  return url.toString();
}

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || searchParams.get('from') || '/';
  const error = searchParams.get('error');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSignIn = () => {
    setIsRedirecting(true);
    window.location.href = buildJanuaLoginUrl(callbackUrl);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Coforma Studio
          </h1>
          <h2 className="mt-6 text-3xl font-bold">Sign in to your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{' '}
            <Link href="/auth/signup" className="text-primary hover:underline">
              create a new account
            </Link>
          </p>
        </div>

        <div className="bg-card p-8 rounded-lg border space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
              <p className="text-sm">
                {error === 'TokenExchange' && 'Authentication failed. Please try again.'}
                {error === 'UserInfo' && 'Could not retrieve your account information.'}
                {error === 'Callback' && 'Error during authentication callback.'}
                {error === 'MissingCode' && 'Authentication response was incomplete.'}
                {error === 'SessionRequired' && 'Please sign in to access this page.'}
                {!['TokenExchange', 'UserInfo', 'Callback', 'MissingCode', 'SessionRequired'].includes(error || '') && 'An error occurred during authentication.'}
              </p>
            </div>
          )}

          {/* Sign in via Janua */}
          <button
            onClick={handleSignIn}
            disabled={isRedirecting}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {isRedirecting ? 'Redirecting...' : 'Sign in with Janua'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            You will be redirected to our secure authentication provider.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
