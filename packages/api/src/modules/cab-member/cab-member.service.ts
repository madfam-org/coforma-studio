import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PhyneCrmRelayService } from '../../integrations/phynecrm/phynecrm-relay.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { LoggerService } from '../../lib/logger/logger.service';
import {
  TenantContextMissingException,
  RecordNotFoundException,
  DuplicateRecordException,
  DatabaseException,
  ValidationException,
} from '../../lib/errors';
import {
  AddMemberInput,
  UpdateMemberInput,
  ListMembersInput,
  InviteMemberInput,
  CABMemberResponse,
  ListMembersResponse,
} from './dto/cab-member.dto';

@Injectable()
export class CABMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly phyneCrmRelay: PhyneCrmRelayService,
  ) {}

  /**
   * Fire-and-forget PhyneCRM emit. Wraps in try/catch as a belt-and-
   * suspenders even though the relay itself never throws. Uses the
   * tenant's `phynecrmTenantId` mapping; skips if unset.
   */
  private async emitToPhynecrm(
    tenantId: string,
    fire: (phynecrmTenantId: string) => Promise<unknown>,
  ): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { phynecrmTenantId: true },
      });
      if (!tenant?.phynecrmTenantId) {
        return; // Tenant not federated to PhyneCRM yet; silent skip.
      }
      await fire(tenant.phynecrmTenantId);
    } catch (err) {
      this.logger.warn(
        `PhyneCRM relay emit failed (non-fatal): ${(err as Error).message}`,
        'CABMemberService',
      );
    }
  }

  /**
   * Add an existing user to a CAB
   * @param tenantId - Tenant ID from authenticated session
   * @param data - Member addition data
   */
  async addMember(tenantId: string, data: AddMemberInput): Promise<CABMemberResponse> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    this.logger.log(`Adding member to CAB: ${data.cabId}`, 'CABMemberService');

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      // Verify CAB exists and belongs to tenant
      const cab = await this.prisma.cAB.findUnique({
        where: { id: data.cabId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!cab) {
        throw new RecordNotFoundException('CAB', data.cabId);
      }

      // Check if CAB has reached max members
      if (cab.maxMembers && cab._count.members >= cab.maxMembers) {
        throw new ValidationException(
          `CAB has reached maximum member limit of ${cab.maxMembers}`
        );
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw new RecordNotFoundException('User', data.userId);
      }

      // Check if user is already a member
      const existingMember = await this.prisma.cABMembership.findUnique({
        where: {
          cabId_userId: {
            cabId: data.cabId,
            userId: data.userId,
          },
        },
      });

      if (existingMember) {
        throw new DuplicateRecordException('CABMembership', 'userId', data.userId);
      }

      // Add member to CAB
      const member = await this.prisma.cABMembership.create({
        data: {
          cabId: data.cabId,
          userId: data.userId,
          company: data.company || null,
          title: data.title || null,
          tags: data.tags || [],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      this.logger.log(`Member added successfully: ${member.id}`, 'CABMemberService');

      // Fan out to PhyneCRM (best-effort; never throws into this path).
      void this.emitToPhynecrm(tenantId, (phynecrmTenantId) =>
        this.phyneCrmRelay.emitMemberJoined(phynecrmTenantId, {
          membershipId: member.id,
          cabId: cab.id,
          cabSlug: cab.slug,
          userEmail: member.user.email,
          userName: member.user.name,
          company: member.company,
          title: member.title,
          phynecrmContactId: null,
        }),
      );

      return member;
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof DuplicateRecordException ||
        error instanceof ValidationException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to add member to CAB: ${data.cabId}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to add member', {
        cabId: data.cabId,
        userId: data.userId,
      });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }

  /**
   * Invite a user to CAB (creates user if doesn't exist)
   * @param tenantId - Tenant ID from authenticated session
   * @param data - Invite member data
   */
  async inviteMember(tenantId: string, data: InviteMemberInput): Promise<CABMemberResponse> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    this.logger.log(`Inviting member to CAB: ${data.cabId}`, 'CABMemberService');

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      // Verify CAB exists and belongs to tenant
      const cab = await this.prisma.cAB.findUnique({
        where: { id: data.cabId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!cab) {
        throw new RecordNotFoundException('CAB', data.cabId);
      }

      // Check if CAB has reached max members
      if (cab.maxMembers && cab._count.members >= cab.maxMembers) {
        throw new ValidationException(
          `CAB has reached maximum member limit of ${cab.maxMembers}`
        );
      }

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
          },
        });
        this.logger.log(`Created new user: ${user.id}`, 'CABMemberService');
      }

      // Check if user is already a member
      const existingMember = await this.prisma.cABMembership.findUnique({
        where: {
          cabId_userId: {
            cabId: data.cabId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        throw new DuplicateRecordException('CABMembership', 'email', data.email);
      }

      // Add member to CAB
      const member = await this.prisma.cABMembership.create({
        data: {
          cabId: data.cabId,
          userId: user.id,
          company: data.company || null,
          title: data.title || null,
          tags: data.tags || [],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      this.logger.log(`Member invited successfully: ${member.id}`, 'CABMemberService');

      // TODO: Send invitation email to user

      return member;
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof DuplicateRecordException ||
        error instanceof ValidationException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to invite member to CAB: ${data.cabId}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to invite member', {
        cabId: data.cabId,
        email: data.email,
      });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }

  /**
   * Update a CAB member
   * @param tenantId - Tenant ID from authenticated session
   * @param data - Member update data
   */
  async update(tenantId: string, data: UpdateMemberInput): Promise<CABMemberResponse> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    this.logger.log(`Updating CAB member: ${data.id}`, 'CABMemberService');

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      // Check if member exists and CAB belongs to tenant
      const existing = await this.prisma.cABMembership.findUnique({
        where: { id: data.id },
        include: {
          cab: true,
        },
      });

      if (!existing) {
        throw new RecordNotFoundException('CABMembership', data.id);
      }

      // Build update data (only include defined fields)
      const updateData: Prisma.CABMembershipUpdateInput = {};
      if (data.company !== undefined) updateData.company = data.company;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.discountPlanId !== undefined) updateData.discountPlanId = data.discountPlanId;

      // Handle NDA signing
      if (data.ndaSigned !== undefined) {
        updateData.ndaSigned = data.ndaSigned;
        if (data.ndaSigned && !existing.ndaSigned) {
          updateData.ndaSignedAt = new Date();
        }
      }

      // Update member
      const member = await this.prisma.cABMembership.update({
        where: { id: data.id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      this.logger.log(`Member updated successfully: ${member.id}`, 'CABMemberService');

      return member;
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to update member: ${data.id}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to update member', { id: data.id });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }

  /**
   * Get a single member by ID
   * @param tenantId - Tenant ID from authenticated session
   * @param id - Member ID
   */
  async findById(tenantId: string, id: string): Promise<CABMemberResponse> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      const member = await this.prisma.cABMembership.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      if (!member) {
        throw new RecordNotFoundException('CABMembership', id);
      }

      return member;
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to find member: ${id}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to find member', { id });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }

  /**
   * List CAB members with filtering
   * @param tenantId - Tenant ID from authenticated session
   * @param query - Query parameters
   */
  async findAll(tenantId: string, query: ListMembersInput): Promise<ListMembersResponse> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      // Verify CAB exists and belongs to tenant
      const cab = await this.prisma.cAB.findUnique({
        where: { id: query.cabId },
      });

      if (!cab) {
        throw new RecordNotFoundException('CAB', query.cabId);
      }

      // Build where clause
      const where: Prisma.CABMembershipWhereInput = {
        cabId: query.cabId,
      };

      if (query.ndaSigned !== undefined) {
        where.ndaSigned = query.ndaSigned;
      }

      if (query.tags && query.tags.length > 0) {
        where.tags = {
          hasSome: query.tags,
        };
      }

      if (query.search) {
        where.OR = [
          { user: { name: { contains: query.search, mode: 'insensitive' } } },
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
          { company: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      // Execute queries in parallel
      const [members, total] = await Promise.all([
        this.prisma.cABMembership.findMany({
          where,
          take: query.limit,
          skip: query.offset,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
              },
            },
          },
        }),
        this.prisma.cABMembership.count({ where }),
      ]);

      return {
        members,
        total,
        limit: query.limit,
        offset: query.offset,
      };
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to list members for CAB: ${query.cabId}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to list members', { cabId: query.cabId });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }

  /**
   * Remove a member from CAB
   * @param tenantId - Tenant ID from authenticated session
   * @param id - Member ID
   */
  async remove(tenantId: string, id: string): Promise<void> {
    if (!tenantId) {
      throw new TenantContextMissingException();
    }

    this.logger.log(`Removing member: ${id}`, 'CABMemberService');

    try {
      // Set tenant context for RLS
      await this.prisma.setTenantContext(tenantId);

      // Check if member exists
      const existing = await this.prisma.cABMembership.findUnique({
        where: { id },
        include: {
          cab: true,
        },
      });

      if (!existing) {
        throw new RecordNotFoundException('CABMembership', id);
      }

      // Remove member
      await this.prisma.cABMembership.delete({
        where: { id },
      });

      this.logger.log(`Member removed successfully: ${id}`, 'CABMemberService');
    } catch (error) {
      if (
        error instanceof RecordNotFoundException ||
        error instanceof TenantContextMissingException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to remove member: ${id}`,
        error instanceof Error ? error.stack : undefined,
        'CABMemberService'
      );

      throw new DatabaseException('Failed to remove member', { id });
    } finally {
      await this.prisma.clearTenantContext();
    }
  }
}
