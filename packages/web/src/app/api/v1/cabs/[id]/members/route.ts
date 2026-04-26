/**
 * POST /api/v1/cabs/[id]/members
 *
 * Adds a member to a CAB. Replaces the dead `trpc.cabMembers.add` flow
 * (which routes through the un-deployed NestJS api). On success, fires
 * the PhyneCRM `cab.member.joined` relay fire-and-forget so the
 * federation half built in PR #61 actually exercises in production.
 *
 * Auth: Janua JWT via `getSession()` → must be ADMIN of the parent
 *       tenant (CAB.tenantId). FACILITATOR is intentionally NOT
 *       sufficient for direct adds — facilitators schedule + run, but
 *       the design-partner intake + light-contract decision is
 *       owner/admin scope per a16z framing.
 *
 * Tenant resolution: derived from CAB.tenantId, never trusted from the
 * caller. Multi-tenant isolation is enforced here, not at the relay.
 *
 * Relay tenant id: looked up via Tenant.phynecrmTenantId. NULL means the
 * tenant isn't federated to PhyneCRM yet — log a warning and skip the
 * relay; never throw. The DB write still succeeds.
 */

import { NextResponse } from 'next/server';
import { PrismaClient, PersonaRole } from '@prisma/client';
import { z } from 'zod';

import { requireTenantRole } from '@/lib/auth-helpers';
import { emitMemberJoined } from '@/lib/phynecrm-relay';

const prisma = new PrismaClient();

/**
 * Duck-type check for Prisma's known-error envelope. We avoid
 * `instanceof Prisma.PrismaClientKnownRequestError` because it
 * (a) requires the symbol from `@prisma/client` (which the type-checker
 * sometimes can't resolve in this monorepo's pre-existing config) and
 * (b) doesn't survive bundler-induced class re-identity. Comparing on
 * `code` is what we actually care about anyway.
 */
function isPrismaKnownError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

const PERSONA_VALUES = ['BUYER', 'END_USER', 'CHAMPION', 'EXECUTIVE'] as const;

const AddMemberBody = z.object({
  contactEmail: z.string().email(),
  name: z.string().min(1).max(200).nullable().optional(),
  persona: z.enum(PERSONA_VALUES).optional(),
  // Free-form descriptor of the member's role within their org. Not the
  // tenant TenantRole — that comes from session. Stored on
  // CABMembership.title for display.
  role: z.string().min(1).max(200).nullable().optional(),
  company: z.string().min(1).max(200).nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: cabId } = await params;

  // Validate path param early so we don't burn a session lookup on a
  // malformed URL.
  if (!cabId || typeof cabId !== 'string') {
    return NextResponse.json({ error: 'invalid_cab_id' }, { status: 400 });
  }

  // Resolve the CAB → tenant. 404 (not 403) on missing CAB is fine here:
  // CAB ids are UUIDs, not enumerable, and the user has to be authed
  // before they reach this point in practice.
  const cab = await prisma.cAB.findUnique({
    where: { id: cabId },
    select: { id: true, tenantId: true, slug: true },
  });
  if (!cab) {
    return NextResponse.json({ error: 'cab_not_found' }, { status: 404 });
  }

  // Auth: ADMIN of the parent tenant.
  const auth = await requireTenantRole(cab.tenantId, ['ADMIN']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // Validate payload.
  let body: z.infer<typeof AddMemberBody>;
  try {
    const json = await req.json();
    body = AddMemberBody.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'invalid_payload', details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  // Resolve the user to attach the membership to. We upsert by email so
  // a previously-unseen contact gets a User shell — same operator-
  // promotion pattern the inbound webhook uses.
  let membershipId: string;
  let userEmail: string;
  let userName: string | null;
  try {
    const user = await prisma.user.upsert({
      where: { email: body.contactEmail },
      update: body.name ? { name: body.name } : {},
      create: {
        email: body.contactEmail,
        name: body.name ?? null,
      },
      select: { id: true, email: true, name: true },
    });

    const membership = await prisma.cABMembership.create({
      data: {
        cabId: cab.id,
        userId: user.id,
        title: body.role ?? null,
        company: body.company ?? null,
        personaRole: body.persona ? (body.persona as PersonaRole) : null,
      },
    });
    membershipId = membership.id;
    userEmail = user.email;
    userName = user.name;
  } catch (err) {
    // Unique-constraint violation (already a member of this CAB) → 409.
    // We compare error.code via duck-type rather than `instanceof` so the
    // path stays valid even when @prisma/client's runtime class identity
    // gets re-bundled (Next.js/turbopack edge cases historically).
    const code = isPrismaKnownError(err) ? err.code : null;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'already_member' }, { status: 409 });
    }
    // Anything else: 500 with masked details. Don't leak Prisma internals
    // to the client; the operator-side has Sentry.
    console.error('cab.members.add db error', { cabId, err });
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // Fire-and-forget PhyneCRM relay. Tenant must be federated for this
  // to do anything; otherwise log + skip. The relay itself never throws.
  const tenant = await prisma.tenant.findUnique({
    where: { id: cab.tenantId },
    select: { phynecrmTenantId: true },
  });

  if (!tenant?.phynecrmTenantId) {
    console.warn('cab.members.add: tenant not federated, skipping relay', {
      cabId,
      tenantId: cab.tenantId,
    });
  } else {
    void emitMemberJoined(tenant.phynecrmTenantId, {
      membershipId,
      cabId: cab.id,
      cabSlug: cab.slug,
      userEmail,
      userName,
      company: body.company ?? null,
      title: body.role ?? null,
      phynecrmContactId: null,
    });
  }

  // Return the freshly-created row. `findUnique` is cheap + gives us
  // the canonical shape including defaults the create() didn't echo
  // back (e.g. exitStatus = ACTIVE).
  const membership = await prisma.cABMembership.findUnique({
    where: { id: membershipId },
  });
  return NextResponse.json({ membership }, { status: 201 });
}
