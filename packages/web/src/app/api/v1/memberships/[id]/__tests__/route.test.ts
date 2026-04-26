/**
 * Tests for DELETE /api/v1/memberships/[id].
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaStub } = vi.hoisted(() => ({
  prismaStub: {
    cABMembership: { findUnique: vi.fn(), update: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireTenantRole: vi.fn(),
}));
vi.mock('@/lib/phynecrm-relay', () => ({
  emitMemberExited: vi.fn(),
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
    MembershipExitStatus: {
      ACTIVE: 'ACTIVE',
      GRADUATED_TO_PAID: 'GRADUATED_TO_PAID',
      CHURNED: 'CHURNED',
      RENEWED: 'RENEWED',
    },
  };
});

import { DELETE } from '../route';
import { requireTenantRole } from '@/lib/auth-helpers';
import { emitMemberExited } from '@/lib/phynecrm-relay';

const requireTenantRoleMock = requireTenantRole as unknown as ReturnType<typeof vi.fn>;
const emitMemberExitedMock = emitMemberExited as unknown as ReturnType<typeof vi.fn>;

function getPrismaInstance(): typeof prismaStub {
  return prismaStub;
}

const MEM_ID = '33333333-3333-3333-3333-333333333333';
const CAB_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const PARAMS = { params: Promise.resolve({ id: MEM_ID }) };

function makeRequest(body?: unknown): Request {
  return new Request(`http://localhost/api/v1/memberships/${MEM_ID}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('DELETE /api/v1/memberships/[id]', () => {
  beforeEach(() => {
    requireTenantRoleMock.mockReset();
    emitMemberExitedMock.mockReset();
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockReset();
    prisma.cABMembership.update.mockReset();
    prisma.tenant.findUnique.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: 200, soft-update, relay fired with exitedAt + status', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: 'crm-c-9',
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'admin@x.com', name: null, image: null, tenants: [] } },
    });
    const updatedRow = { id: MEM_ID, cabId: CAB_ID, exitStatus: 'CHURNED', exitedAt: new Date() };
    prisma.cABMembership.update.mockResolvedValue(updatedRow);
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: 'madfam' });
    emitMemberExitedMock.mockResolvedValue({ ok: true });

    const res = await DELETE(makeRequest({ exitStatus: 'CHURNED', reason: 'no fit' }), PARAMS);

    expect(res.status).toBe(200);
    expect(prisma.cABMembership.update).toHaveBeenCalledTimes(1);
    expect(prisma.cABMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEM_ID },
        data: expect.objectContaining({ exitStatus: 'CHURNED', exitNote: 'no fit' }),
      }),
    );
    expect(emitMemberExitedMock).toHaveBeenCalledTimes(1);
    const callArgs = emitMemberExitedMock.mock.calls[0]!;
    expect(callArgs[0]).toBe('madfam');
    expect(callArgs[1]).toMatchObject({
      membershipId: MEM_ID,
      cabId: CAB_ID,
      exitNote: 'no fit',
      phynecrmContactId: 'crm-c-9',
    });
    expect(callArgs[1].exitedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults exitStatus to CHURNED when body omitted', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'admin@x.com', name: null, image: null, tenants: [] } },
    });
    prisma.cABMembership.update.mockResolvedValue({ id: MEM_ID });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: 'madfam' });

    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.cABMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exitStatus: 'CHURNED' }),
      }),
    );
  });

  it('401 when no session', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({ ok: false, status: 401, reason: 'unauthenticated' });

    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
  });

  it('403 on insufficient role', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({ ok: false, status: 403, reason: 'insufficient_role' });

    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(403);
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
  });

  it('400 on invalid exitStatus payload', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });

    const res = await DELETE(makeRequest({ exitStatus: 'NOT_A_REAL_STATUS' }), PARAMS);
    expect(res.status).toBe(400);
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
  });

  it('404 when membership not found', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
    expect(requireTenantRoleMock).not.toHaveBeenCalled();
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
  });

  it('tenant unmapped: 200 still, relay NOT called, warn logged', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });
    prisma.cABMembership.update.mockResolvedValue({ id: MEM_ID });
    prisma.tenant.findUnique.mockResolvedValue({ phynecrmTenantId: null });
    const warnSpy = vi.spyOn(console, 'warn');

    const res = await DELETE(makeRequest({ exitStatus: 'CHURNED' }), PARAMS);
    expect(res.status).toBe(200);
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('DB failure on update: 500, relay NOT called', async () => {
    const prisma = getPrismaInstance();
    prisma.cABMembership.findUnique.mockResolvedValue({
      id: MEM_ID,
      cabId: CAB_ID,
      phynecrmContactId: null,
      cab: { tenantId: TENANT_ID },
    });
    requireTenantRoleMock.mockResolvedValue({
      ok: true,
      session: { user: { id: 'u1', email: 'a@a.com', name: null, image: null, tenants: [] } },
    });
    prisma.cABMembership.update.mockRejectedValue(new Error('db down'));

    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(500);
    expect(emitMemberExitedMock).not.toHaveBeenCalled();
  });
});
