# API Test Suite

> [!IMPORTANT]
> RLS tests may create tenant/customer-shaped fixtures. Keep test data synthetic, never copy production tenant data into fixtures, and guard database resets or seeded tenant datasets as DB/customer-data operations.

This directory contains comprehensive tests for the Coforma Studio API, with a focus on Row-Level Security (RLS) tenant isolation.

## Test Structure

```
test/
├── setup.ts              # Global test setup and teardown
├── utils/
│   └── test-helpers.ts  # Reusable test utilities
├── rls/
│   └── tenant-isolation.test.ts  # RLS integration tests
└── README.md            # This file
```

## Running Tests

### Prerequisites

1. Ensure PostgreSQL is running (via Docker Compose)
2. Set up a test database:

```bash
# Using Docker Compose
docker-compose up -d postgres

# Or manually create test database
createdb coforma_test
```

3. Set environment variables:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coforma_test"
export NODE_ENV="test"
```

### Running the Full Test Suite

```bash
# From the api package directory
pnpm test

# With coverage
pnpm test:cov

# Watch mode (re-run on changes)
pnpm test:watch
```

### Running Specific Tests

```bash
# Run only RLS tests
pnpm vitest run test/rls/

# Run a specific test file
pnpm vitest run test/rls/tenant-isolation.test.ts

# Run tests matching a pattern
pnpm vitest run -t "Tenant Isolation"
```

## Test Categories

### 1. RLS Integration Tests (`test/rls/`)

**Purpose:** Verify Row-Level Security policies enforce proper tenant isolation.

**Critical Test Cases:**
- ✅ Tenant A cannot access Tenant B's CABs
- ✅ Tenant A cannot access Tenant B's sessions
- ✅ Tenant A cannot access Tenant B's feedback
- ✅ Comments and votes are isolated by tenant
- ✅ RLS context can be set and cleared
- ✅ Queries without context return no results

**Why These Tests Are Critical:**
Multi-tenant data isolation is the #1 security requirement. These tests verify that the PostgreSQL RLS policies work correctly and prevent data leakage between tenants.

### 2. Prisma Service Unit Tests (`src/lib/prisma/*.spec.ts`)

**Purpose:** Verify Prisma service RLS methods work correctly.

**Test Cases:**
- ✅ `setTenantContext()` sets the correct PostgreSQL session variable
- ✅ `clearTenantContext()` resets the session variable
- ✅ SQL injection prevention via parameterized queries
- ✅ Connection lifecycle management

## Test Data Management

### Setup and Teardown

The test suite automatically:
1. Runs migrations before all tests (`beforeAll`)
2. Clears all data between tests (`afterEach`)
3. Resets RLS context between tests
4. Disconnects from database after tests (`afterAll`)

### Creating Test Data

Use the helper functions in `test/utils/test-helpers.ts`:

```typescript
import { createTestTenant, setTenantContext } from '../utils/test-helpers';

// Create a tenant with admin user
const { tenant, admin, membership } = await createTestTenant(prisma, {
  tenantSlug: 'my-test-tenant',
  tenantName: 'My Test Tenant',
});

// Set RLS context
await setTenantContext(prisma, tenant.id);

// Now queries will be scoped to this tenant
const cabs = await prisma.cAB.findMany();
```

## Writing New Tests

### Best Practices

1. **Always clear context between tests**
   ```typescript
   afterEach(async () => {
     await clearTenantContext(prisma);
   });
   ```

2. **Test both positive and negative cases**
   ```typescript
   // Positive: Can access own data
   await setTenantContext(prisma, tenantA.id);
   const data = await prisma.cAB.findMany();
   expect(data).toHaveLength(1);

   // Negative: Cannot access other tenant's data
   const otherData = await prisma.cAB.findUnique({
     where: { id: tenantB.cabId }
   });
   expect(otherData).toBeNull();
   ```

3. **Use descriptive test names**
   ```typescript
   it('should prevent tenant A from accessing tenant B CABs', async () => {
     // Test implementation
   });
   ```

4. **Test complex relationships**
   - Verify that RLS cascades through foreign keys
   - Test queries with joins across multiple tables

## CI/CD Integration

Tests run automatically in GitHub Actions:

```yaml
# .github/workflows/ci.yml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: coforma_test
```

## Troubleshooting

### Tests failing with "app.tenant_id not set"

This means RLS context wasn't set before a query:

```typescript
// ❌ Wrong
const cabs = await prisma.cAB.findMany();

// ✅ Correct
await setTenantContext(prisma, tenantId);
const cabs = await prisma.cAB.findMany();
```

### Tests seeing data from other tests

The `afterEach` cleanup might be failing. Check:
1. Database connection is active
2. All foreign key constraints are handled
3. Deletion order (children before parents)

### RLS policies not enforced

Verify:
1. Migrations were run: `pnpm prisma migrate deploy`
2. Database is PostgreSQL 15+ (RLS support)
3. RLS is enabled on tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

## Coverage Goals

Target coverage from `CONTRIBUTING.md`:
- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

Current priority: **RLS tests must have 90%+ coverage** due to criticality.

## Security Testing Checklist

Before deploying multi-tenant features:

- [ ] All tenant-scoped tables have RLS policies
- [ ] All RLS policies tested with integration tests
- [ ] Verified tenant A cannot query tenant B data (all models)
- [ ] Verified RLS context properly set in tRPC procedures
- [ ] Verified queries without context return empty
- [ ] SQL injection prevention tested
- [ ] Cross-tenant foreign key queries tested

## Additional Resources

- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Project Security Policy: `../../SECURITY.md`
