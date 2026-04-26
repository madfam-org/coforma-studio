/**
 * Tests for POST /api/v1/cabs/[id]/feedback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaStub } = vi.hoisted(() => ({
  prismaStub: {
    cAB: { findUnique: vi.fn() },
    cABMembership: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
    feedbackItem: { create: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireSession: vi.fn(),
}));
vi.mock('@/lib/phynecrm-relay', () => ({
  emitFeedbackCreated: vi.fn(),
}));
vi.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    PrismaClient: vi.fn().mockImplementation(() => prismaStub),
    Prisma: { PrismaClientKnownRequestError },
  };
});

import { POST } from '../route';
import { requireSession } from '@/lib/auth-helpers';
import { emitFeedbackCreated } from '@/lib/phynecrm-relay';

const requireSessionMock = requireSession as unknown as ReturnType<typeof vi.fn>;
const emitFeedbackCreatedMock = emitFeedbackCreated as unknown as ReturnType<typeof vi.fn>;

function getPrismaInstance(): typeof prismaStub {
  return prismaStub;
}

const CAB_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_ID = '44444444-4444-4444-4444-444444444444';
const PARAMS = { params: Promise.resolve({ id: CAB_ID }) };

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/cabs/${CAB_ID}/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function adminSession(): {
  ok: true;
  session: {
    user: {
      id: string;
      email: string;
      name: null;
      image: null;
      tenants: Array<{ id: string; slug: string; name: string; logo: null; brandColor: null; role: 'ADMIN' | 'FACILITATOR' | 'MEMBER' }>;
    };
  };
} {
  return {
    ok: true,
    session: {
      user: {
        id: 'user-1',
        email: 'admin@x.com',
        name: null,
        image: null,
        tenants: [{ id: TENANT_ID, slug: 't', name: 'T', logo: null, brandColor: null, role: 'ADMIN' }],
      },
    },
  };
}

describe('POST /api/v1/cabs/[id]/feedback', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    emitFeedbackCreatedMock.mockReset();
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockReset();
    prisma.cABMembership.findFirst.mockReset();
    prisma.session.findUnique.mockReset();
    prisma.feedbackItem.create.mockReset();
    prisma.feedbackItem.findUnique.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.tenant.findUnique.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    sessionId: SESSION_ID,
    sentiment: 'POSITIVE',
    summary: 'Loved the new export feature',
    body: 'Specifically the CSV roundtrip. Saves 20 min/week.',
    persona: 'BUYER',
  };

  it('happy path (tenant admin): 201, FeedbackItem created with mapped fields, relay fired', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 'tezca' });
    requireSessionMock.mockResolvedValue(adminSession());
    prisma.session.findUnique.mockResolvedValue({ cabId: CAB_ID });
    prisma.feedbackItem.create.mockResolvedValue({ id: 'fb-1' });
    prisma.user.findUnique.mockResolvedValue({ email: 'admin@x.com' });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: 'madfam' });
    prisma.feedbackItem.findUnique.mockResolvedValue({ id: 'fb-1', title: 'Loved the new export feature' });

    const res = await POST(makeRequest(validBody), PARAMS);

    expect(res.status).toBe(201);
    expect(prisma.feedbackItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          cabId: CAB_ID,
          sessionId: SESSION_ID,
          userId: 'user-1',
          title: validBody.summary,
          description: validBody.body,
          type: 'RESEARCH_INSIGHT',
          tags: expect.arrayContaining(['sentiment:POSITIVE', 'persona:BUYER']),
        }),
      }),
    );
    expect(emitFeedbackCreatedMock).toHaveBeenCalledTimes(1);
    expect(emitFeedbackCreatedMock).toHaveBeenCalledWith('madfam', expect.objectContaining({
      feedbackId: 'fb-1',
      cabId: CAB_ID,
      authorEmail: 'admin@x.com',
      type: 'RESEARCH_INSIGHT',
      title: validBody.summary,
      body: validBody.body,
      priority: null,
    }));
  });

  it('happy path (CAB member, not tenant admin): 201 + relay fired with member phynecrmContactId', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 'tezca' });
    requireSessionMock.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: 'user-9',
          email: 'member@x.com',
          name: null,
          image: null,
          tenants: [], // not a tenant member
        },
      },
    });
    prisma.cABMembership.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      // First call: membership lookup for auth (exitedAt: null)
      if ('exitedAt' in where) return Promise.resolve({ id: 'mem-7' });
      // Second call: phynecrmContactId lookup
      return Promise.resolve({ phynecrmContactId: 'crm-c-77' });
    });
    prisma.session.findUnique.mockResolvedValue({ cabId: CAB_ID });
    prisma.feedbackItem.create.mockResolvedValue({ id: 'fb-2' });
    prisma.user.findUnique.mockResolvedValue({ email: 'member@x.com' });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: 'madfam' });
    prisma.feedbackItem.findUnique.mockResolvedValue({ id: 'fb-2' });

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(201);
    expect(emitFeedbackCreatedMock).toHaveBeenCalledWith(
      'madfam',
      expect.objectContaining({ phynecrmContactId: 'crm-c-77' }),
    );
  });

  it('401 when no session', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue({ ok: false, status: 401, reason: 'unauthenticated' });

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(401);
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
  });

  it('403 when caller is neither tenant admin nor CAB member', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue({
      ok: true,
      session: {
        user: { id: 'user-x', email: 'x@x.com', name: null, image: null, tenants: [] },
      },
    });
    prisma.cABMembership.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(403);
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
  });

  it('400 on invalid payload (Zod errors with details)', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue(adminSession());

    const res = await POST(makeRequest({ sentiment: 'BOGUS', summary: '', body: '' }), PARAMS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_payload');
    expect(json.details).toBeDefined();
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
  });

  it('400 when sessionId belongs to a different CAB', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue(adminSession());
    prisma.session.findUnique.mockResolvedValue({ cabId: 'some-other-cab' });

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(400);
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
  });

  it('tenant unmapped: 201 still, relay NOT called, warn logged', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue(adminSession());
    prisma.session.findUnique.mockResolvedValue({ cabId: CAB_ID });
    prisma.feedbackItem.create.mockResolvedValue({ id: 'fb-3' });
    prisma.user.findUnique.mockResolvedValue({ email: 'admin@x.com' });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: null });
    prisma.feedbackItem.findUnique.mockResolvedValue({ id: 'fb-3' });
    const warnSpy = vi.spyOn(console, 'warn');

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(201);
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('DB failure on create: 500, relay NOT called', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 't' });
    requireSessionMock.mockResolvedValue(adminSession());
    prisma.session.findUnique.mockResolvedValue({ cabId: CAB_ID });
    prisma.feedbackItem.create.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(validBody), PARAMS);
    expect(res.status).toBe(500);
    expect(emitFeedbackCreatedMock).not.toHaveBeenCalled();
  });
});
