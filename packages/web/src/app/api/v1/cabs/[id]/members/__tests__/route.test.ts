/**
 * Tests for POST /api/v1/cabs/[id]/members.
 *
 * Coverage matrix:
 *   - Happy path: 201, relay called once with correct args
 *   - Auth: 401 (no session), 403 (wrong role)
 *   - Validation: 400 with Zod details
 *   - Tenant unmapped: 201 still, relay NOT called, warn logged
 *   - DB failure: 500, relay NOT called
 *   - Conflict: 409 on duplicate membership
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted singleton DB stub. `vi.mock` factories can't reference
// outer-scope locals (they're hoisted above the imports), so we
// allocate the stub via `vi.hoisted()` which IS available to factories.
const { prismaStub } = vi.hoisted(() => ({
  prismaStub: {
    cAB: { findUnique: vi.fn() },
    user: { upsert: vi.fn() },
    cABMembership: { create: vi.fn(), findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireTenantRole: vi.fn(),
}));
vi.mock('@/lib/phynecrm-relay', () => ({
  emitMemberJoined: vi.fn(),
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
    PersonaRole: { BUYER: 'BUYER', END_USER: 'END_USER', CHAMPION: 'CHAMPION', EXECUTIVE: 'EXECUTIVE' },
  };
});

import { POST } from '../route';
import { requireTenantRole } from '@/lib/auth-helpers';
import { emitMemberJoined } from '@/lib/phynecrm-relay';

const requireTenantRoleMock = requireTenantRole as unknown as ReturnType<typeof vi.fn>;
const emitMemberJoinedMock = emitMemberJoined as unknown as ReturnType<typeof vi.fn>;

function getPrismaInstance(): typeof prismaStub {
  return prismaStub;
}

const CAB_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const PARAMS = { params: Promise.resolve({ id: CAB_ID }) };

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/cabs/${CAB_ID}/members`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/cabs/[id]/members', () => {
  beforeEach(() => {
    requireTenantRoleMock.mockReset();
    emitMemberJoinedMock.mockReset();
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockReset();
    prisma.user.upsert.mockReset();
    prisma.cABMembership.create.mockReset();
    prisma.cABMembership.findUnique.mockReset();
    prisma.tenant.findUnique.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: 201 + relay fired with correct args', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 'tezca-spring' });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'admin@x.com', name: null, image: null, tenants: [] } },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'user-9', email: 'a@b.com', name: 'A B' });
    prisma.cABMembership.create.mockResolvedValue({ id: 'mem-1' });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: 'madfam' });
    prisma.cABMembership.findUnique.mockResolvedValue({ id: 'mem-1', cabId: CAB_ID });
    emitMemberJoinedMock.mockResolvedValue({ ok: true, status: 200 });

    const res = await POST(
      makeRequest({ contactEmail: 'a@b.com', name: 'A B', role: 'CTO', persona: 'BUYER', company: 'Acme' }),
      PARAMS,
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.membership.id).toBe('mem-1');
    expect(emitMemberJoinedMock).toHaveBeenCalledTimes(1);
    expect(emitMemberJoinedMock).toHaveBeenCalledWith('madfam', {
      membershipId: 'mem-1',
      cabId: CAB_ID,
      cabSlug: 'tezca-spring',
      userEmail: 'a@b.com',
      userName: 'A B',
      company: 'Acme',
      title: 'CTO',
      phynecrmContactId: null,
    });
  });

  it('401 when unauthenticated (no session)', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({ ok: false, status: 401, reason: 'unauthenticated' });

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(401);
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });

  it('403 when caller has wrong role (FACILITATOR not enough)', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({ ok: false, status: 403, reason: 'insufficient_role' });

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(403);
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });

  it('400 with Zod details on invalid payload', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });

    const res = await POST(makeRequest({ contactEmail: 'not-an-email' }), PARAMS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_payload');
    expect(json.details).toBeDefined();
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });

  it('tenant unmapped: 201 still, relay NOT called, warn logged', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'user-9', email: 'a@b.com', name: null });
    prisma.cABMembership.create.mockResolvedValue({ id: 'mem-2' });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: null });
    prisma.cABMembership.findUnique.mockResolvedValue({ id: 'mem-2' });
    const warnSpy = vi.spyOn(console, 'warn');

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(201);
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('DB failure: 500, relay NOT called', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'user-9', email: 'a@b.com', name: null });
    prisma.cABMembership.create.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(500);
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });

  it('409 on duplicate membership (Prisma P2002)', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue({ id: CAB_ID, tenantId: TENANT_ID, slug: 's' });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'user-9', email: 'a@b.com', name: null });
    // Duck-typed Prisma known-error: route.ts checks `.code === 'P2002'`,
    // not `instanceof`, to survive class-identity re-bundling.
    const dupErr = Object.assign(new Error('unique violation'), { code: 'P2002' });
    prisma.cABMembership.create.mockRejectedValue(dupErr);

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(409);
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });

  it('404 when CAB does not exist', async () => {
    const prisma = getPrismaInstance();
    prisma.cAB.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ contactEmail: 'a@b.com' }), PARAMS);
    expect(res.status).toBe(404);
    expect(requireTenantRoleMock).not.toHaveBeenCalled();
    expect(emitMemberJoinedMock).not.toHaveBeenCalled();
  });
});
