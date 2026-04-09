'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const JANUA_ISSUER_URL = process.env.NEXT_PUBLIC_JANUA_ISSUER_URL || '';
const JANUA_CLIENT_ID = process.env.NEXT_PUBLIC_JANUA_CLIENT_ID || '';

export default function SignOutPage() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear the local session cookie via API
      await fetch('/api/auth/signout', { method: 'POST' });
      setSignedOut(true);

      // Redirect to Janua's logout endpoint to clear the SSO session,
      // then back to the home page
      const appUrl = window.location.origin;
      const logoutUrl = new URL(`${JANUA_ISSUER_URL}/logout`);
      logoutUrl.searchParams.set('client_id', JANUA_CLIENT_ID);
      logoutUrl.searchParams.set('post_logout_redirect_uri', appUrl);

      // Give user a moment to see the confirmation, then redirect
      setTimeout(() => {
        window.location.href = logoutUrl.toString();
      }, 1500);
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  if (signedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-lg border">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold mb-2">Signed Out Successfully</h2>
            <p className="text-muted-foreground mb-8">
              You have been signed out. Redirecting...
            </p>

            <div className="space-y-3">
              <Link
                href="/auth/signin"
                className="block w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition text-center"
              >
                Sign In Again
              </Link>
              <Link
                href="/"
                className="block text-sm text-primary hover:underline"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-lg border">
        <div className="text-center">
          {/* Sign Out Icon */}
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>

          <h2 className="text-3xl font-bold mb-2">Sign Out</h2>
          <p className="text-muted-foreground mb-8">
            Are you sure you want to sign out of your account?
          </p>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSigningOut ? 'Signing out...' : 'Yes, Sign Out'}
            </button>
            <button
              onClick={() => router.back()}
              disabled={isSigningOut}
              className="w-full px-4 py-3 border border-input rounded-lg font-semibold hover:bg-accent transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
