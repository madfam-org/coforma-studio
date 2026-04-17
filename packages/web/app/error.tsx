'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '28rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          Something went wrong
        </h2>
        <p style={{ color: '#6b7280', margin: '0 0 1rem', fontSize: '0.875rem' }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: '0.75rem',
              color: '#9ca3af',
              margin: '0 0 1.5rem',
            }}
          >
            Error ID: {error.digest}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: '#111827',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              color: '#111827',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
