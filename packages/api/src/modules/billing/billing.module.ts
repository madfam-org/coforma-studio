/**
 * Billing Module for Coforma Studio
 *
 * Integrates @madfam/billing with NestJS for subscription management,
 * tier-based access control, and usage tracking.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BILLING_SERVICE,
  BILLING_OPTIONS,
  BillingModuleOptions,
  createBillingService,
  SubscriptionGuard,
  TierGuard,
  FeatureGuard,
  UsageLimitGuard,
  UsageTrackingInterceptor,
} from '@madfam/billing/nestjs';
import { createJanuaClient } from '@janua/client';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Global()
@Module({
  controllers: [BillingController],
  providers: [
    // Billing options configuration
    {
      provide: BILLING_OPTIONS,
      useFactory: (configService: ConfigService): BillingModuleOptions => ({
        clientFactory: () =>
          createJanuaClient({
            baseUrl: configService.get('JANUA_API_URL', 'https://auth.madfam.io'),
            apiKey: configService.get('JANUA_API_KEY'),
          }),
        organizationResolver: (request) => {
          // Extract tenant/organization ID from request
          // Coforma uses tenant-based multi-tenancy
          return (
            request.user?.tenantId ||
            request.headers['x-tenant-id'] ||
            request.query.tenant_id
          );
        },
        enableUsageTracking: true,
        cacheTtl: 60000, // 1 minute cache
      }),
      inject: [ConfigService],
    },

    // Core billing service from @madfam/billing
    {
      provide: BILLING_SERVICE,
      useFactory: (options: BillingModuleOptions) => {
        const client = options.clientFactory();
        return createBillingService({ client });
      },
      inject: [BILLING_OPTIONS],
    },

    // Local billing service wrapper
    BillingService,

    // Guards
    SubscriptionGuard,
    TierGuard,
    FeatureGuard,
    UsageLimitGuard,

    // Interceptors
    UsageTrackingInterceptor,
  ],
  exports: [BILLING_SERVICE, BILLING_OPTIONS, BillingService],
})
export class BillingModule {}
