'use client';

import Link from 'next/link';
import { useState } from 'react';

const JANUA_ISSUER_URL = process.env.NEXT_PUBLIC_JANUA_ISSUER_URL || '';
const JANUA_CLIENT_ID = process.env.NEXT_PUBLIC_JANUA_CLIENT_ID || '';

function buildJanuaSignupUrl(): string {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectUri = `${appUrl}/api/auth/callback`;

  const url = new URL(`${JANUA_ISSUER_URL}/register`);
  url.searchParams.set('client_id', JANUA_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', '/onboarding');
  return url.toString();
}

export default function SignUpPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSignUp = () => {
    setIsRedirecting(true);
    window.location.href = buildJanuaSignupUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Coforma Studio
          </h1>
          <h2 className="mt-6 text-3xl font-bold">Create your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="bg-card p-8 rounded-lg border space-y-6">
          {/* Sign up via Janua */}
          <button
            onClick={handleSignUp}
            disabled={isRedirecting}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {isRedirecting ? 'Redirecting...' : 'Create account with Janua'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            You will be redirected to our secure authentication provider to
            create your account.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
