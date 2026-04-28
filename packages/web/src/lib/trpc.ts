import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@coforma/api/trpc-router';

/**
 * Create tRPC React hooks
 * Type-safe API client for frontend
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get API URL based on environment
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative URL
    return '';
  }

  // SSR should use full URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Default to localhost in development
  return `http://localhost:${process.env.PORT || 4000}`;
}

/**
 * tRPC client configuration
 */
export const trpcConfig = {
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      headers: () => {
        const headers: Record<string, string> = {};

        // Add tenant ID from URL if available (for tenant-scoped requests)
        if (typeof window !== 'undefined') {
          const pathParts = window.location.pathname.split('/');
          if (pathParts[1] && pathParts[1] !== 'auth') {
            headers['x-tenant-slug'] = pathParts[1];
          }
        }

        return headers;
      },
      // Include credentials for cookie-based auth
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
};
