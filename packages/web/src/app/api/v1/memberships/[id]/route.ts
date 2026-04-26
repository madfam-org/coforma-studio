/**
 * DELETE /api/v1/memberships/[id]
 *
 * Exits a CAB member. Soft-delete: sets `exitedAt = now()` and
 * `exitStatus` to one of MembershipExitStatus values. Idempotent at the
 * DB layer — a re-exit (CHURNED → RENEWED → CHURNED) intentionally
 * updates `exitedAt` to the new timestamp; the relay's idempotency key
 * includes `exitedAt` so re-exits are distinct events on the receiver.
 *
 * Auth: Janua JWT via `getSession()` → must be ADMIN of the membership's
 *       parent tenant.
 *
 * Tenant resolution: derived from membership.cab.tenantId; never trusted
 * from caller.
 *
 * Relay: fired fire-and-forget after a successful DB update. Tenant
 *        without `phynecrmTenantId` → warn + skip.
 */

import { NextResponse } from 'next/server';
import { PrismaClient, MembershipExitStatus } from '@prisma/client';
import { z } from 'zod';

import { requireTenantRole } from '@/lib/auth-helpers';
import { emitMemberExited } from '@/lib/phynecrm-relay';

const prisma = new PrismaClient();

/** Duck-type narrow for Prisma known-error envelope (see members/route.ts). */
function prismaErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const c = (err as { code: unknown }).code;
    return typeof c === 'string' ? c : null;
  }
  return null;
}

const EXIT_STATUS_VALUES = ['GRADUATED_TO_PAID', 'CHURNED', 'RENEWED'] as const;

const ExitMemberBody = z.object({
  exitStatus: z.enum(EXIT_STATUS_VALUES).optional(),
  reason: z.string().min(1).max(2000).nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: membershipId } = await params;

  if (!membershipId || typeof membershipId !== 'string') {
    return NextResponse.json({ error: 'invalid_membership_id' }, { status: 400 });
  }

  // Resolve membership → tenant up front so we can scope auth and have
  // the user.email + cab.id ready for the relay payload.
  const existing = await prisma.cABMembership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      cabId: true,
      phynecrmContactId: true,
      cab: { select: { tenantId: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'membership_not_found' }, { status: 404 });
  }

  // Auth: ADMIN of the parent tenant.
  const auth = await requireTenantRole(existing.cab.tenantId, ['ADMIN']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // Body is optional — DELETE with no body is "exit with no metadata".
  // Default to CHURNED unless the caller provides exitStatus.
  let body: z.infer<typeof ExitMemberBody> = {};
  const rawText = await req.text();
  if (rawText && rawText.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
    }
    const result = ExitMemberBody.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: 'invalid_payload', details: result.error.flatten() },
        { status: 400 },
      );
    }
    body = result.data;
  }

  const exitStatus = (body.exitStatus ?? 'CHURNED') as MembershipExitStatus;
  const exitedAt = new Date();

  // Update is idempotent: re-exit refreshes timestamp + status. The
  // relay key includes exitedAt so each re-exit is a distinct receiver-
  // side event.
  let updated;
  try {
    updated = await prisma.cABMembership.update({
      where: { id: existing.id },
      data: {
        exitedAt,
        exitStatus,
        exitNote: body.reason ?? null,
      },
    });
  } catch (err) {
    const code = prismaErrorCode(err);
    if (code) {
      console.error('memberships.exit db error', { membershipId, code });
    } else {
      console.error('memberships.exit db error', { membershipId, err });
    }
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // Fire relay fire-and-forget.
  const tenant = await prisma.tenant.findUnique({
    where: { id: existing.cab.tenantId },
    select: { phynecrmTenantId: true },
  });

  if (!tenant?.phynecrmTenantId) {
    console.warn('memberships.exit: tenant not federated, skipping relay', {
      membershipId,
      tenantId: existing.cab.tenantId,
    });
  } else {
    void emitMemberExited(tenant.phynecrmTenantId, {
      membershipId: updated.id,
      cabId: existing.cabId,
      exitedAt: exitedAt.toISOString(),
      exitNote: body.reason ?? null,
      phynecrmContactId: existing.phynecrmContactId,
    });
  }

  return NextResponse.json({ membership: updated }, { status: 200 });
}
