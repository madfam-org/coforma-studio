-- a16z follow-up: PartnershipAgreement + Session.requiredRoles.
-- See packages/api/prisma/schema.prisma for field-level commentary.

-- New enum --------------------------------------------------------------
CREATE TYPE "EngagementCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');

-- Session.requiredRoles -------------------------------------------------
ALTER TABLE "sessions"
  ADD COLUMN "requiredRoles" JSONB;

-- PartnershipAgreement --------------------------------------------------
CREATE TABLE "partnership_agreements" (
  "id"                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "membershipId"           UUID            NOT NULL,
  "createdAt"              TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3)    NOT NULL,
  "scope"                  TEXT            NOT NULL,
  "cadence"                "EngagementCadence" NOT NULL DEFAULT 'BIWEEKLY',
  "expectedHoursPerMonth"  INTEGER         NOT NULL,
  "effectiveStart"         TIMESTAMP(3)    NOT NULL,
  "effectiveEnd"           TIMESTAMP(3),
  "acceptedAt"             TIMESTAMP(3),
  "acceptedByEmail"        TEXT,
  "notes"                  TEXT
);

-- 1:1 with CABMembership.
CREATE UNIQUE INDEX "partnership_agreements_membershipId_key"
  ON "partnership_agreements"("membershipId");

-- Index for "expiring agreements" query (operator dashboard).
CREATE INDEX "partnership_agreements_effectiveEnd_idx"
  ON "partnership_agreements"("effectiveEnd");

ALTER TABLE "partnership_agreements"
  ADD CONSTRAINT "partnership_agreements_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "cab_memberships"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Sanity check: hours/month must be positive.
ALTER TABLE "partnership_agreements"
  ADD CONSTRAINT "partnership_agreements_expectedHoursPerMonth_positive"
    CHECK ("expectedHoursPerMonth" > 0);
