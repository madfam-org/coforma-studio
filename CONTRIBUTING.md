# Contributing to Coforma Studio

Thank you for your interest in contributing to Coforma Studio! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing](#testing)
8. [Documentation](#documentation)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- **Node.js** v20+ (LTS)
- **pnpm** v8+
- **Docker** (for local PostgreSQL, Redis, Meilisearch)
- **Git**

### Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/madfam-io/coforma-studio.git
cd coforma-studio
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your local configuration
```

4. **Start local services** (PostgreSQL, Redis, Meilisearch)

```bash
docker-compose up -d
```

5. **Run database migrations**

```bash
pnpm db:migrate
```

6. **Seed the database** (optional)

```bash
pnpm db:seed
```

7. **Start development servers**

```bash
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Prisma Studio: http://localhost:5555 (run `pnpm db:studio`)

## Development Workflow

### Branching Strategy

We use **Git Flow** with the following branches:

- `main` - Production-ready code
- `develop` - Integration branch for next release
- `feature/*` - New features (branch from `develop`)
- `fix/*` - Bug fixes (branch from `develop`)
- `hotfix/*` - Critical fixes (branch from `main`)

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write code** following our [coding standards](#coding-standards)
2. **Write tests** for new functionality
3. **Run tests** to ensure nothing breaks
4. **Commit changes** following [commit guidelines](#commit-guidelines)
5. **Push to your branch** and open a Pull Request

## Coding Standards

### TypeScript

- **Use strict mode** (configured in `tsconfig.json`)
- **Prefer type inference** where possible
- **Avoid `any`** (use `unknown` if type is truly unknown)
- **Use interfaces for object shapes**, types for unions/intersections

```typescript
// ✅ GOOD
interface User {
  id: string;
  email: string;
  name: string | null;
}

// ❌ BAD
type User = {
  id: any;
  email: string;
  name: string;
};
```

### React / Next.js

- **Use functional components** with hooks
- **Prefer Server Components** (Next.js App Router)
- **Use client components** only when necessary (`'use client'`)
- **Extract reusable logic** into custom hooks

```typescript
// ✅ GOOD: Server Component (default)
export default function Page() {
  return <div>Server Component</div>;
}

// ✅ GOOD: Client Component (when needed)
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### File Naming

- **React components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities/helpers**: camelCase (e.g., `formatDate.ts`)
- **API routes**: kebab-case (e.g., `create-user.ts`)
- **Test files**: `*.test.ts` or `*.spec.ts`

### Folder Structure

```
packages/web/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Route groups
│   ├── api/               # API routes
│   └── [tenant]/          # Dynamic routes
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   └── domain/            # Domain-specific components
├── lib/                   # Utilities, helpers
├── hooks/                 # Custom React hooks
└── styles/                # Global styles

packages/api/
├── src/
│   ├── modules/           # NestJS modules
│   │   ├── tenants/
│   │   ├── cabs/
│   │   └── sessions/
│   ├── common/            # Shared code (guards, decorators, filters)
│   ├── config/            # Configuration
│   └── main.ts            # Entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Migrations
│   └── seed.ts            # Seed script
└── test/                  # E2E tests
```

### ESLint & Prettier

- **Run linter** before committing: `pnpm lint`
- **Auto-fix** issues: `pnpm lint:fix`
- **Format code**: `pnpm format`
- **Husky** will auto-format staged files on commit

### Import Order

Follow this import order (enforced by ESLint):

1. Built-in Node modules (`fs`, `path`)
2. External packages (`react`, `next`, `prisma`)
3. Internal packages (`@coforma/types`, `@coforma/ui`)
4. Relative imports (`./Button`, `../lib/utils`)

```typescript
// ✅ GOOD
import { useState } from 'react';
import { prisma } from '@coforma/api';
import { Button } from '@coforma/ui';
import { formatDate } from '@/lib/utils';

// ❌ BAD (wrong order)
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
```

## Commit Guidelines

We use **Conventional Commits** for clear, semantic commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring (no feature/fix)
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (dependencies, config)
- `ci` - CI/CD changes

### Examples

```bash
feat(cabs): add ability to archive CABs

Implements archiving functionality for CABs. Archived CABs are hidden
from the main list but can be restored by admins.

Closes #123
```

```bash
fix(auth): resolve session expiration bug

Sessions were expiring prematurely due to incorrect timezone handling.
Now using UTC for all session timestamps.

Fixes #456
```

```bash
docs(api): update API documentation for feedback endpoints
```

### Commit Message Rules

- **Use imperative mood** ("add feature" not "added feature")
- **Limit subject line** to 72 characters
- **Capitalize subject line**
- **No period at end** of subject line
- **Separate subject and body** with blank line
- **Reference issues** in footer (`Closes #123`, `Fixes #456`)

## Pull Request Process

### Before Opening a PR

1. ✅ **All tests pass** (`pnpm test`)
2. ✅ **Linter passes** (`pnpm lint`)
3. ✅ **Type check passes** (`pnpm typecheck`)
4. ✅ **Code is formatted** (`pnpm format`)
5. ✅ **Branch is up to date** with base branch

### PR Title

Use the same format as commit messages:

```
feat(cabs): add CAB archiving functionality
```

### PR Description Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual testing

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged

## Screenshots (if applicable)

## Related Issues

Closes #123
```

### Code Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one approval** from a core team member
3. **All comments resolved**
4. **Squash and merge** (we maintain clean history)

### Review Checklist for Reviewers

- [ ] Code follows style guidelines
- [ ] No security vulnerabilities introduced
- [ ] RLS policies maintained (for multi-tenancy)
- [ ] Input validation present
- [ ] Tests cover new functionality
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance considered

## Testing

### Testing Philosophy

- **Unit tests**: Test individual functions/components in isolation
- **Integration tests**: Test interaction between modules
- **E2E tests**: Test complete user workflows

### Writing Tests

#### Unit Tests (Vitest)

```typescript
// packages/api/src/lib/formatDate.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('should format date in ISO format', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('2025-01-15');
  });

  it('should handle null dates', () => {
    expect(formatDate(null)).toBeNull();
  });
});
```

#### Integration Tests (Prisma + PostgreSQL)

```typescript
// packages/api/test/cabs.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

describe('CAB CRUD operations', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { slug: 'test-tenant', name: 'Test Tenant' },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('should create a CAB', async () => {
    const cab = await prisma.cab.create({
      data: {
        tenantId,
        name: 'Test CAB',
        slug: 'test-cab',
      },
    });

    expect(cab.name).toBe('Test CAB');
  });
});
```

#### E2E Tests (Playwright)

```typescript
// packages/web/tests/e2e/signup.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign up', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Run tests with coverage
pnpm test --coverage
```

### Test Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Documentation

### Code Comments

- **Document why**, not what (code should be self-documenting)
- **Use JSDoc** for public APIs
- **Explain complex logic** or non-obvious decisions

```typescript
/**
 * Calculates the feedback-to-implementation ratio for a tenant.
 *
 * This metric tracks how many CAB feedback items have been shipped
 * vs. total feedback submitted. Used in Program Health dashboard.
 *
 * @param tenantId - The tenant ID
 * @param dateRange - Optional date range filter
 * @returns The ratio as a percentage (0-100)
 */
export async function calculateFeedbackRatio(
  tenantId: string,
  dateRange?: DateRange
): Promise<number> {
  // Implementation...
}
```

### Updating Documentation

When adding features, update:

- [ ] API documentation (`docs/api-specification.md`)
- [ ] Database schema docs (`docs/database-schema.md`)
- [ ] README (if user-facing feature)
- [ ] CHANGELOG.md (for releases)

## Additional Resources

- [Project Vision](./PRODUCT_VISION.md)
- [Software Specification](./SOFTWARE_SPEC.md)
- [Technology Stack](./TECH_STACK.md)
- [Security Policy](./SECURITY.md)
- [Operating Model](./OPERATING_MODEL.md)

## Questions?

- **Technical**: Ask in #engineering Slack channel
- **Product**: Ask in #product Slack channel
- **General**: hello@innovacionesmadfam.dev

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Coforma Studio! 🚀
