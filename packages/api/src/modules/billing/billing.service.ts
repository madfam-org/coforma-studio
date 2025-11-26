/**
 * Coforma Studio Billing Service
 *
 * Wraps @madfam/billing with Coforma-specific business logic
 * for CAB subscription management.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  BILLING_SERVICE,
  BillingService as MadfamBillingService,
  BillingContext,
  BillingPlan,
  Subscription,
  CreateCheckoutInput,
  CheckoutSession,
} from '@madfam/billing/nestjs';

// Coforma-specific plan tiers
export enum CoformaPlanTier {
  FREE = 'free',
  STARTER = 'starter',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

// Coforma feature flags
export const COFORMA_FEATURES = {
  UNLIMITED_CABS: 'unlimited_cabs',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  CUSTOM_BRANDING: 'custom_branding',
  SSO_INTEGRATION: 'sso_integration',
  PRIORITY_SUPPORT: 'priority_support',
  API_ACCESS: 'api_access',
  WHITE_LABEL: 'white_label',
  DEDICATED_CSM: 'dedicated_csm',
} as const;

// Plan limits for Coforma
export const COFORMA_PLAN_LIMITS = {
  free: {
    cabs: 1,
    members_per_cab: 10,
    sessions_per_month: 2,
    storage_gb: 1,
  },
  starter: {
    cabs: 3,
    members_per_cab: 25,
    sessions_per_month: 10,
    storage_gb: 10,
  },
  growth: {
    cabs: 10,
    members_per_cab: 100,
    sessions_per_month: 50,
    storage_gb: 50,
  },
  enterprise: {
    cabs: -1, // unlimited
    members_per_cab: -1,
    sessions_per_month: -1,
    storage_gb: 500,
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(BILLING_SERVICE)
    private readonly billingService: MadfamBillingService
  ) {}

  /**
   * Set the tenant context for billing operations
   */
  setTenantContext(tenantId: string): void {
    this.billingService.setOrganizationId(tenantId);
  }

  /**
   * Get billing context for a tenant
   */
  async getBillingContext(tenantId?: string): Promise<BillingContext> {
    if (tenantId) {
      this.setTenantContext(tenantId);
    }
    return this.billingService.getBillingContext();
  }

  /**
   * Get current subscription for tenant
   */
  async getCurrentSubscription(tenantId?: string): Promise<Subscription | null> {
    if (tenantId) {
      this.setTenantContext(tenantId);
    }
    return this.billingService.getCurrentSubscription();
  }

  /**
   * Get available plans
   */
  async getPlans(): Promise<BillingPlan[]> {
    return this.billingService.getPlans();
  }

  /**
   * Create checkout session for plan upgrade
   */
  async createCheckout(
    tenantId: string,
    input: CreateCheckoutInput
  ): Promise<CheckoutSession> {
    this.setTenantContext(tenantId);
    return this.billingService.createCheckout(input);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    tenantId: string,
    immediate: boolean = false
  ): Promise<Subscription> {
    this.setTenantContext(tenantId);
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      throw new Error('No active subscription found');
    }
    return this.billingService.cancelSubscription(subscription.id, immediate);
  }

  /**
   * Check if tenant can create more CABs
   */
  async canCreateCAB(tenantId: string, currentCabCount: number): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);

    if (!context.subscription) {
      // Free tier default
      return currentCabCount < COFORMA_PLAN_LIMITS.free.cabs;
    }

    const tier = context.subscription.tier as CoformaPlanTier;
    const limit = COFORMA_PLAN_LIMITS[tier]?.cabs ?? COFORMA_PLAN_LIMITS.free.cabs;

    return limit === -1 || currentCabCount < limit;
  }

  /**
   * Check if tenant can add more members to a CAB
   */
  async canAddCABMember(
    tenantId: string,
    currentMemberCount: number
  ): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);

    if (!context.subscription) {
      return currentMemberCount < COFORMA_PLAN_LIMITS.free.members_per_cab;
    }

    const tier = context.subscription.tier as CoformaPlanTier;
    const limit = COFORMA_PLAN_LIMITS[tier]?.members_per_cab ?? COFORMA_PLAN_LIMITS.free.members_per_cab;

    return limit === -1 || currentMemberCount < limit;
  }

  /**
   * Check if tenant can create more sessions this month
   */
  async canCreateSession(
    tenantId: string,
    sessionsThisMonth: number
  ): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);

    if (!context.subscription) {
      return sessionsThisMonth < COFORMA_PLAN_LIMITS.free.sessions_per_month;
    }

    const tier = context.subscription.tier as CoformaPlanTier;
    const limit = COFORMA_PLAN_LIMITS[tier]?.sessions_per_month ?? COFORMA_PLAN_LIMITS.free.sessions_per_month;

    return limit === -1 || sessionsThisMonth < limit;
  }

  /**
   * Check if tenant has access to a specific feature
   */
  async hasFeature(
    tenantId: string,
    feature: keyof typeof COFORMA_FEATURES
  ): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);
    return context.can_access_feature(COFORMA_FEATURES[feature]);
  }

  /**
   * Get plan limits for tenant
   */
  async getPlanLimits(tenantId: string): Promise<typeof COFORMA_PLAN_LIMITS.free> {
    const context = await this.getBillingContext(tenantId);

    if (!context.subscription) {
      return COFORMA_PLAN_LIMITS.free;
    }

    const tier = context.subscription.tier as CoformaPlanTier;
    return COFORMA_PLAN_LIMITS[tier] ?? COFORMA_PLAN_LIMITS.free;
  }

  /**
   * Record CAB session usage
   */
  async recordSessionUsage(tenantId: string): Promise<void> {
    this.setTenantContext(tenantId);
    await this.billingService.recordUsage('sessions', 1);
    this.logger.log(`Recorded session usage for tenant ${tenantId}`);
  }

  /**
   * Record storage usage
   */
  async recordStorageUsage(tenantId: string, bytesUsed: number): Promise<void> {
    this.setTenantContext(tenantId);
    const gbUsed = bytesUsed / (1024 * 1024 * 1024);
    await this.billingService.recordUsage('storage_gb', gbUsed);
  }

  /**
   * Get customer portal URL for tenant
   */
  async getPortalUrl(tenantId: string, returnUrl?: string): Promise<string> {
    this.setTenantContext(tenantId);
    return this.billingService.getCustomerPortalUrl(returnUrl);
  }

  /**
   * Check if subscription is in trial
   */
  async isInTrial(tenantId: string): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);
    return context.is_trialing;
  }

  /**
   * Check if subscription is past due
   */
  async isPastDue(tenantId: string): Promise<boolean> {
    const context = await this.getBillingContext(tenantId);
    return context.is_past_due;
  }

  /**
   * Get remaining trial days
   */
  async getRemainingTrialDays(tenantId: string): Promise<number | null> {
    const subscription = await this.getCurrentSubscription(tenantId);

    if (!subscription?.trial_end) {
      return null;
    }

    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();

    if (diffMs <= 0) {
      return 0;
    }

    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}
