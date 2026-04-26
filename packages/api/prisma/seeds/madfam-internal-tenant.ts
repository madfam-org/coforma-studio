/**
 * MADFAM-Internal Tenant Seed — Tezca CAB (Spring 2026)
 *
 * Per RFC 0013 Wave PMF-3 + ADR-003 (Tulana ↔ Coforma webhook contract).
 *
 * Creates:
 *   - Tenant: "MADFAM Internal — PMF Measurement" (slug: madfam-internal, private)
 *   - Owner User: aldoruizluna@madfam.io (TenantRole.ADMIN)
 *   - First CAB: "Tezca CAB — Spring 2026" (slug: tezca-spring-2026)
 *
 * The Sean Ellis PMF template is referenced (not stamped onto the CAB itself, since
 * the schema currently has no `templateId` field on CAB). The template metadata is
 * stamped onto seeded sessions' `agendaItems` JSON column instead.
 *
 * This seed is idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm --filter @coforma/api prisma db seed -- --tenant=madfam-internal
 *
 * Or directly:
 *   pnpm --filter @coforma/api tsx prisma/seeds/madfam-internal-tenant.ts
 */

import { PrismaClient, TenantRole } from '@prisma/client';

import { SEAN_ELLIS_PMF_TEMPLATE } from './templates/sean-ellis-pmf-template';

const prisma = new PrismaClient();

const TENANT_SLUG = 'madfam-internal';
const TENANT_NAME = 'MADFAM Internal — PMF Measurement';
const OWNER_EMAIL = 'aldoruizluna@madfam.io';
const OWNER_NAME = 'Aldo Ruiz Luna';
const CAB_SLUG = 'tezca-spring-2026';
const CAB_NAME = 'Tezca CAB — Spring 2026';
const CAB_DESCRIPTION =
  'Customer Advisory Board for Tezca legal-data-as-API platform. ' +
  'Quarterly cohort 5-15 members. Sean Ellis PMF interviews + roadmap-linkage to Tezca Linear/Jira.';

/**
 * Tenant metadata flag indicating private (no public listing) tenants.
 * Stored under `Tenant.brandColor`-adjacent conventions; since the schema has no
 * explicit `visibility` column we encode it in `subscriptionStatus` as a marker.
 *
 * Operator follow-up: when the tenant schema gains a `visibility` enum, migrate
 * this marker. Tracked in PROJECT_STATUS.md (file an issue if not already there).
 */
const PRIVATE_VISIBILITY_MARKER = 'internal_private';

export async function seedMadfamInternalTenant(): Promise<{
  tenantId: string;
  ownerUserId: string;
  cabId: string;
}> {
  console.log('🌱 [madfam-internal] Seeding MADFAM Internal tenant + Tezca CAB...');

  // 1. Tenant — upsert by slug
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {
      name: TENANT_NAME,
    },
    create: {
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      locale: 'en',
      timezone: 'America/Mexico_City',
      brandColor: '#0A0A0A', // MADFAM black
      // Private/internal — never offered for public sign-up.
      // See PRIVATE_VISIBILITY_MARKER comment above.
      subscriptionStatus: PRIVATE_VISIBILITY_MARKER,
      whitelabelEnabled: false,
    },
  });
  console.log(`   ✅ Tenant: ${tenant.slug} (${tenant.id})`);

  // 2. Owner user — upsert by email
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: {
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      emailVerified: new Date(),
    },
  });
  console.log(`   ✅ Owner: ${owner.email} (${owner.id})`);

  // 3. Tenant membership — owner as ADMIN
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: owner.id,
      },
    },
    update: { role: TenantRole.ADMIN },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: TenantRole.ADMIN,
    },
  });
  console.log(`   ✅ TenantMembership: ${owner.email} → ADMIN of ${tenant.slug}`);

  // 4. First CAB — Tezca Spring 2026
  const cab = await prisma.cAB.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: CAB_SLUG,
      },
    },
    update: {
      name: CAB_NAME,
      description: CAB_DESCRIPTION,
    },
    create: {
      tenantId: tenant.id,
      slug: CAB_SLUG,
      name: CAB_NAME,
      description: CAB_DESCRIPTION,
      isActive: true,
      maxMembers: 15, // Per RFC 0013 Wave PMF-3 cohort sizing
      requiresNDA: false, // Internal cohort; founder will brief verbally
    },
  });
  console.log(`   ✅ CAB: ${cab.slug} (${cab.id})`);

  // 5. Audit log entry — record that the seed ran (operator-traceable)
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      action: 'seed.madfam_internal.applied',
      resource: 'Tenant',
      resourceId: tenant.id,
      metadata: {
        seed: 'madfam-internal-tenant',
        rfc: 'RFC-0013-Wave-PMF-3',
        adr: 'ADR-003-Tulana-Coforma-Integration',
        cab_slug: CAB_SLUG,
        sean_ellis_template: SEAN_ELLIS_PMF_TEMPLATE.template_id,
        sean_ellis_template_version: SEAN_ELLIS_PMF_TEMPLATE.version,
      },
    },
  });
  console.log(`   ✅ AuditLog: seed.madfam_internal.applied`);

  console.log('🎉 [madfam-internal] Seed complete.');
  console.log('');
  console.log('   Next operator steps:');
  console.log('   1. Set TULANA_PMF_WEBHOOK_SECRET env var (must match Tulana COFORMA_WEBHOOK_SECRET)');
  console.log('   2. Set TULANA_API_URL env var (default: https://api.tulana.madfam.io)');
  console.log('   3. Pull first 30 Tezca API key users with ≥10 calls in last 30d');
  console.log('   4. Send founder-approved invites for week of 2026-05-15');
  console.log('');

  return {
    tenantId: tenant.id,
    ownerUserId: owner.id,
    cabId: cab.id,
  };
}

// CLI entry point — invoked when this file is run directly via `tsx` or
// when prisma seed forwards `--tenant=madfam-internal`.
const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith('madfam-internal-tenant.ts');

const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
const requestedTenant = tenantArg ? tenantArg.split('=')[1] : null;

if (invokedDirectly || requestedTenant === TENANT_SLUG) {
  seedMadfamInternalTenant()
    .catch((err) => {
      console.error('❌ [madfam-internal] Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
