/**
 * Billing Module Exports
 */

export { BillingModule } from './billing.module';
export { BillingService, COFORMA_FEATURES, COFORMA_PLAN_LIMITS, CoformaPlanTier } from './billing.service';
export { BillingController } from './billing.controller';

// Re-export useful types and guards from @madfam/billing
export {
  RequiresTier,
  RequiresFeature,
  TrackUsage,
  UsageLimit,
  SubscriptionGuard,
  TierGuard,
  FeatureGuard,
  UsageLimitGuard,
  PaymentRequiredException,
  SubscriptionExpiredException,
  UsageLimitExceededException,
  FeatureNotAvailableException,
} from '@madfam/billing/nestjs';
