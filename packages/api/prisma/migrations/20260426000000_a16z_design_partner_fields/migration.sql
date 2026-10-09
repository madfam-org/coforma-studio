-- a16z design-partner framework alignment.
-- All additive: nullable columns + new enums + indexes.
-- See packages/api/prisma/schema.prisma for field-level commentary.

-- New enums --------------------------------------------------------------
CREATE TYPE "PersonaRole" AS ENUM ('BUYER', 'END_USER', 'CHAMPION', 'EXECUTIVE');

CREATE TYPE "MembershipExitStatus" AS ENUM ('ACTIVE', 'GRADUATED_TO_PAID', 'CHURNED', 'RENEWED');

-- CAB: cohort window + portfolio floor ----------------------------------
ALTER TABLE "cabs"
  ADD COLUMN "minMembers"  INTEGER,
  ADD COLUMN "cohortLabel" TEXT,
  ADD COLUMN "startDate"   TIMESTAMP(3),
  ADD COLUMN "endDate"     TIMESTAMP(3);

-- CABMembership: persona role + 3-criterion intake + lifecycle ----------
ALTER TABLE "cab_memberships"
  ADD COLUMN "personaRole"             "PersonaRole",
  ADD COLUMN "representativenessScore" INTEGER,
  ADD COLUMN "urgencyScore"            INTEGER,
  ADD COLUMN "capacityScore"           INTEGER,
  ADD COLUMN "intakeJustification"     TEXT,
  ADD COLUMN "exitStatus"              "MembershipExitStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "exitedAt"                TIMESTAMP(3),
  ADD COLUMN "exitNote"                TEXT;

-- New index for filtering active vs graduated members per CAB.
CREATE INDEX "cab_memberships_cabId_exitStatus_idx"
  ON "cab_memberships"("cabId", "exitStatus");

-- Score sanity checks (0-10 inclusive). Run on new writes only — existing
-- NULL rows are unaffected.
ALTER TABLE "cab_memberships"
  ADD CONSTRAINT "cab_memberships_representativenessScore_range"
    CHECK ("representativenessScore" IS NULL OR ("representativenessScore" BETWEEN 0 AND 10)),
  ADD CONSTRAINT "cab_memberships_urgencyScore_range"
    CHECK ("urgencyScore" IS NULL OR ("urgencyScore" BETWEEN 0 AND 10)),
  ADD CONSTRAINT "cab_memberships_capacityScore_range"
    CHECK ("capacityScore" IS NULL OR ("capacityScore" BETWEEN 0 AND 10));
