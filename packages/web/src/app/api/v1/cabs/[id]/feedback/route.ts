/**
 * POST /api/v1/cabs/[id]/feedback
 *
 * Records feedback in a CAB session. Persists a `FeedbackItem` row in
 * Coforma DB and fires `cab.feedback.created` to PhyneCRM fire-and-forget.
 *
 * Auth: Janua JWT via `getSession()` → must be a CAB member (any
 *       CABMembership for this CAB tied to the session user) OR ADMIN
 *       of the parent tenant. FACILITATOR of the tenant counts as admin
 *       for feedback recording (they're the ones running the session).
 *
 * Schema mapping. The route body is shaped around session-recording
 * semantics (sentiment, summary, persona); the underlying FeedbackItem
 * model is more general. We map:
 *   summary  → FeedbackItem.title
 *   body     → FeedbackItem.description
 *   sentiment+ persona → FeedbackItem.tags (string[])
 *   sessionId → FeedbackItem.sessionId
 *   type      → RESEARCH_INSIGHT (the only FeedbackType that fits a
 *               CAB-session capture cleanly; ideas/bugs/requests live in
 *               their own product flows).
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { requireSession, type RequireAuthResult } from '@/lib/auth-helpers';
import { emitFeedbackCreated } from '@/lib/phynecrm-relay';

const prisma = new PrismaClient();

/** Duck-type narrow for Prisma known-error envelope. */
function prismaErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const c = (err as { code: unknown }).code;
    return typeof c === 'string' ? c : null;
  }
  return null;
}

const SENTIMENT_VALUES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'] as const;
const PERSONA_VALUES = ['BUYER', 'END_USER', 'CHAMPION', 'EXECUTIVE'] as const;

const FeedbackBody = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  sentiment: z.enum(SENTIMENT_VALUES),
  summary: z.string().min(1).max(500),
  body: z.string().min(1).max(10_000),
  persona: z.enum(PERSONA_VALUES).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: cabId } = await params;

  if (!cabId || typeof cabId !== 'string') {
    return NextResponse.json({ error: 'invalid_cab_id' }, { status: 400 });
  }

  const cab = await prisma.cAB.findUnique({
    where: { id: cabId },
    select: { id: true, tenantId: true, slug: true },
  });
  if (!cab) {
    return NextResponse.json({ error: 'cab_not_found' }, { status: 404 });
  }

  // Auth: session required. Permission is "tenant ADMIN/FACILITATOR" OR
  // "CAB member". We do the session check first, then a single query to
  // determine the looser CAB-member grant.
  const authResult: RequireAuthResult = await requireSession();
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }
  const userId = authResult.session.user.id;
  const tenantMembership = authResult.session.user.tenants.find((t) => t.id === cab.tenantId);

  const isTenantAdmin =
    tenantMembership?.role === 'ADMIN' || tenantMembership?.role === 'FACILITATOR';

  let isCabMember = false;
  if (!isTenantAdmin) {
    const cabMembership = await prisma.cABMembership.findFirst({
      where: { cabId: cab.id, userId, exitedAt: null },
      select: { id: true },
    });
    isCabMember = Boolean(cabMembership);
  }

  if (!isTenantAdmin && !isCabMember) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Validate payload.
  let body: z.infer<typeof FeedbackBody>;
  try {
    const json = await req.json();
    body = FeedbackBody.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'invalid_payload', details: err.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  // Verify session belongs to this CAB if a sessionId was supplied.
  // Cross-CAB session ids are a config bug, not a malicious actor case;
  // 400 is fine. Skip check when sessionId is omitted.
  if (body.sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
      select: { cabId: true },
    });
    if (!session || session.cabId !== cab.id) {
      return NextResponse.json({ error: 'session_not_in_cab' }, { status: 400 });
    }
  }

  const tags: string[] = [`sentiment:${body.sentiment}`];
  if (body.persona) tags.push(`persona:${body.persona}`);

  let feedbackId: string;
  let userEmail: string;
  let phynecrmContactId: string | null = null;
  try {
    const feedback = await prisma.feedbackItem.create({
      data: {
        tenantId: cab.tenantId,
        cabId: cab.id,
        sessionId: body.sessionId ?? null,
        userId,
        title: body.summary,
        description: body.body,
        type: 'RESEARCH_INSIGHT',
        tags,
      },
    });
    feedbackId = feedback.id;

    // Pull author email + (optional) PhyneCRM contact id for the relay
    // payload. Single round-trip; OK to do post-write since the relay
    // is fire-and-forget.
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    userEmail = author?.email ?? authResult.session.user.email;

    if (isCabMember) {
      const memberLink = await prisma.cABMembership.findFirst({
        where: { cabId: cab.id, userId },
        select: { phynecrmContactId: true },
      });
      phynecrmContactId = memberLink?.phynecrmContactId ?? null;
    }
  } catch (err) {
    const code = prismaErrorCode(err);
    if (code) {
      console.error('cab.feedback.create db error', { cabId, code });
    } else {
      console.error('cab.feedback.create db error', { cabId, err });
    }
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // Fire-and-forget relay.
  const tenant = await prisma.tenant.findUnique({
    where: { id: cab.tenantId },
    select: { phynecrmTenantId: true },
  });

  if (!tenant?.phynecrmTenantId) {
    console.warn('cab.feedback.create: tenant not federated, skipping relay', {
      cabId,
      tenantId: cab.tenantId,
    });
  } else {
    void emitFeedbackCreated(tenant.phynecrmTenantId, {
      feedbackId,
      cabId: cab.id,
      authorEmail: userEmail,
      type: 'RESEARCH_INSIGHT',
      title: body.summary,
      body: body.body,
      priority: null,
      phynecrmContactId,
    });
  }

  const feedback = await prisma.feedbackItem.findUnique({
    where: { id: feedbackId },
  });
  return NextResponse.json({ feedback }, { status: 201 });
}
