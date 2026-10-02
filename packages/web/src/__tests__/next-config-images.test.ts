import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards the Next.js image-optimizer posture (GHSA-2xp9-vwfh-vxw4 defence in
// depth). Nothing in packages/web imports next/image, so the optimizer is off
// and /_next/image answers 404. The middleware matcher skips /_next/image, so
// an enabled optimizer would be reachable without a session. Widening the
// allow-list is a security decision: change it here, in next.config.js and in
// AGENTS.md together.

const require = createRequire(import.meta.url);
const webRoot = fileURLToPath(new URL('../..', import.meta.url));
const nextConfig = require(path.join(webRoot, 'next.config.js')) as {
  images?: {
    unoptimized?: boolean;
    remotePatterns?: unknown[];
    domains?: unknown;
  };
};

function filesImportingNextImage(dir: string): string[] {
  const offenders: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules')
        offenders.push(...filesImportingNextImage(full));
    } else if (
      /\.(t|j)sx?$/.test(entry.name) &&
      /from\s+['"]next\/(legacy\/)?image['"]/.test(readFileSync(full, 'utf8'))
    ) {
      offenders.push(path.relative(webRoot, full));
    }
  }
  return offenders;
}

describe('next.config.js images posture', () => {
  it('disables the built-in image optimizer', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it('keeps remotePatterns an exact, empty allow-list with no legacy domains', () => {
    expect(nextConfig.images?.remotePatterns).toEqual([]);
    expect(nextConfig.images?.domains).toBeUndefined();
  });

  it('has no source file importing next/image', () => {
    expect(
      filesImportingNextImage(path.join(webRoot, 'src')),
      'next/image was imported; revisit images.unoptimized before shipping'
    ).toEqual([]);
  });
});
