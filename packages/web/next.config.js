const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  swcMinify: true,

  // Skip tRPC v10 / React Query type collision errors during build
  typescript: { ignoreBuildErrors: true },

  // Lint is enforced by the dedicated CI lint job (`pnpm lint`), not the
  // image build. Before the root `@eslint/js` devDependency was added the
  // flat config failed to load and `next build` silently skipped linting;
  // this keeps that behavior explicit instead of accidental.
  eslint: { ignoreDuringBuilds: true },

  // Transpile workspace packages
  transpilePackages: ['@coforma/types', '@coforma/ui'],

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Images: GHSA-2xp9-vwfh-vxw4 defence in depth. Nothing in this app imports
  // next/image (avatars are plain <img> tags), so Next's built-in optimizer is
  // off and /_next/image answers 404. The middleware matcher skips
  // /_next/image, so an enabled optimizer would be reachable without a
  // session. The allow-list is exact and empty (it replaces `domains` and a
  // `**.r2.dev` wildcard that matched every public R2 bucket), so re-enabling
  // optimization later cannot turn the app into an open image proxy.
  // Guarded by src/__tests__/next-config-images.test.ts.
  images: {
    unoptimized: true,
    remotePatterns: [],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },

  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
