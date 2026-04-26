import { PrismaClient } from '@prisma/client';

import { seedMadfamInternalTenant } from './seeds/madfam-internal-tenant';

const prisma = new PrismaClient();

/**
 * Parses CLI flags forwarded after `--`:
 *   pnpm prisma db seed -- --tenant=madfam-internal
 * If --tenant is omitted, runs the default demo seed only.
 */
function getRequestedTenant(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--tenant='));
  return arg ? arg.split('=')[1] : null;
}

async function seedDemo() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Organization',
      locale: 'en',
      timezone: 'America/Mexico_City',
    },
  });
  console.log('✅ Created demo tenant:', tenant.slug);
}

async function main() {
  console.log('🌱 Seeding database...');

  const requested = getRequestedTenant();

  if (requested === 'madfam-internal') {
    await seedMadfamInternalTenant();
  } else if (requested === 'demo' || requested === null) {
    await seedDemo();
  } else {
    console.warn(
      `⚠️  Unknown --tenant=${requested}. Known: demo, madfam-internal. Running demo seed.`,
    );
    await seedDemo();
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
