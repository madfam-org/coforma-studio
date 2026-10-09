-- PhyneCRM schema-glue: external IDs + IntegrationProvider enum value.
-- Pure additive: nullable columns, enum extension, new index.
-- See packages/api/prisma/schema.prisma for field-level commentary.

-- Extend the IntegrationProvider enum -----------------------------------
ALTER TYPE "IntegrationProvider" ADD VALUE 'PHYNECRM';

-- Tenant.phynecrmTenantId (1:1 with PhyneCRM tenantId) ------------------
ALTER TABLE "tenants"
  ADD COLUMN "phynecrmTenantId" TEXT;

CREATE UNIQUE INDEX "tenants_phynecrmTenantId_key"
  ON "tenants"("phynecrmTenantId");

-- CABMembership: external IDs -------------------------------------------
ALTER TABLE "cab_memberships"
  ADD COLUMN "phynecrmContactId"    TEXT,
  ADD COLUMN "phynecrmEngagementId" TEXT;

-- Index for inbound-webhook dedup lookups by PhyneCRM contactId.
CREATE INDEX "cab_memberships_phynecrmContactId_idx"
  ON "cab_memberships"("phynecrmContactId");
