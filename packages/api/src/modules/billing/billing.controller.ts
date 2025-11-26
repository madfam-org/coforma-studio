/**
 * Billing Controller for Coforma Studio
 *
 * REST endpoints for billing operations.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { SubscriptionGuard } from '@madfam/billing/nestjs';
import type { BillingInterval } from '@madfam/billing';

// DTOs
class CreateCheckoutDto {
  plan_id: string;
  billing_interval: BillingInterval;
  success_url: string;
  cancel_url: string;
}

class CancelSubscriptionDto {
  immediate?: boolean;
}

@ApiTags('billing')
@Controller('billing')
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({ status: 200, description: 'Returns available plans' })
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription' })
  @ApiResponse({ status: 200, description: 'Returns current subscription or null' })
  async getSubscription(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return null;
    }
    return this.billingService.getCurrentSubscription(tenantId);
  }

  @Get('context')
  @ApiOperation({ summary: 'Get full billing context' })
  @ApiResponse({ status: 200, description: 'Returns billing context with subscription, plan, and limits' })
  async getBillingContext(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return {
        subscription: null,
        plan: null,
        is_premium: false,
        is_trialing: false,
        is_past_due: false,
      };
    }
    return this.billingService.getBillingContext(tenantId);
  }

  @Get('limits')
  @ApiOperation({ summary: 'Get current plan limits' })
  @ApiResponse({ status: 200, description: 'Returns plan limits for current subscription' })
  async getPlanLimits(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return this.billingService.getPlanLimits('');
    }
    return this.billingService.getPlanLimits(tenantId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create checkout session for subscription' })
  @ApiResponse({ status: 201, description: 'Returns checkout session with URL' })
  async createCheckout(@Request() req: any, @Body() dto: CreateCheckoutDto) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    return this.billingService.createCheckout(tenantId, {
      plan_id: dto.plan_id,
      billing_interval: dto.billing_interval,
      success_url: dto.success_url,
      cancel_url: dto.cancel_url,
    });
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  async cancelSubscription(
    @Request() req: any,
    @Body() dto: CancelSubscriptionDto
  ) {
    const tenantId = req.user?.tenantId;
    return this.billingService.cancelSubscription(tenantId, dto.immediate);
  }

  @Get('portal')
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Get customer portal URL' })
  @ApiResponse({ status: 200, description: 'Returns portal URL' })
  async getPortalUrl(
    @Request() req: any,
    @Query('return_url') returnUrl?: string
  ) {
    const tenantId = req.user?.tenantId;
    const url = await this.billingService.getPortalUrl(tenantId, returnUrl);
    return { url };
  }

  @Get('trial')
  @ApiOperation({ summary: 'Get trial status' })
  @ApiResponse({ status: 200, description: 'Returns trial information' })
  async getTrialStatus(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { is_trialing: false, remaining_days: null };
    }

    const [isTrialing, remainingDays] = await Promise.all([
      this.billingService.isInTrial(tenantId),
      this.billingService.getRemainingTrialDays(tenantId),
    ]);

    return {
      is_trialing: isTrialing,
      remaining_days: remainingDays,
    };
  }

  @Get('check/cab')
  @ApiOperation({ summary: 'Check if tenant can create more CABs' })
  @ApiResponse({ status: 200, description: 'Returns whether creation is allowed' })
  async canCreateCAB(
    @Request() req: any,
    @Query('current_count') currentCount: string
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { allowed: false, reason: 'No tenant context' };
    }

    const count = parseInt(currentCount || '0', 10);
    const allowed = await this.billingService.canCreateCAB(tenantId, count);

    return {
      allowed,
      reason: allowed ? null : 'CAB limit reached for current plan',
    };
  }

  @Get('check/member')
  @ApiOperation({ summary: 'Check if tenant can add more CAB members' })
  @ApiResponse({ status: 200, description: 'Returns whether addition is allowed' })
  async canAddMember(
    @Request() req: any,
    @Query('current_count') currentCount: string
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { allowed: false, reason: 'No tenant context' };
    }

    const count = parseInt(currentCount || '0', 10);
    const allowed = await this.billingService.canAddCABMember(tenantId, count);

    return {
      allowed,
      reason: allowed ? null : 'Member limit reached for current plan',
    };
  }

  @Get('check/session')
  @ApiOperation({ summary: 'Check if tenant can create more sessions this month' })
  @ApiResponse({ status: 200, description: 'Returns whether creation is allowed' })
  async canCreateSession(
    @Request() req: any,
    @Query('sessions_this_month') sessionsThisMonth: string
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { allowed: false, reason: 'No tenant context' };
    }

    const count = parseInt(sessionsThisMonth || '0', 10);
    const allowed = await this.billingService.canCreateSession(tenantId, count);

    return {
      allowed,
      reason: allowed ? null : 'Session limit reached for current billing period',
    };
  }

  @Get('check/feature/:feature')
  @ApiOperation({ summary: 'Check if tenant has access to a feature' })
  @ApiResponse({ status: 200, description: 'Returns feature access status' })
  async hasFeature(@Request() req: any, @Query('feature') feature: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { has_access: false };
    }

    const hasAccess = await this.billingService.hasFeature(
      tenantId,
      feature as any
    );

    return { has_access: hasAccess };
  }
}
