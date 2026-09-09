-- Step 9 fix: align database with prisma/schema.prisma (schema drift correction)
--
-- The hand-written migrations (step4/step5) created some columns as TEXT and
-- with database-level UUID defaults, while the Prisma schema declares
-- VARCHAR sizes and client-side @default(uuid()). This migration reconciles
-- the two. DROP DEFAULT statements are no-ops where no default exists, so the
-- file is safe to replay on any database state.

-- Align Cooperative column types with @db.VarChar declarations
ALTER TABLE "Cooperative" ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "location" SET DATA TYPE VARCHAR(240),
ALTER COLUMN "operatingArea" SET DATA TYPE VARCHAR(240),
ALTER COLUMN "contactEmail" SET DATA TYPE VARCHAR(254),
ALTER COLUMN "contactPhone" SET DATA TYPE VARCHAR(16);

-- Align SkillCategory column types with @db.VarChar declarations
ALTER TABLE "SkillCategory" ALTER COLUMN "name" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(500);

-- UUIDs are generated client-side (@default(uuid())), so no DB-level default
ALTER TABLE "Certificate" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Cooperative" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "CooperativeMembership" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Skill" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "SkillEvidence" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "SkillVerification" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Worker" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "WorkerExperience" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "WorkerSkill" ALTER COLUMN "id" DROP DEFAULT;

-- updatedAt is maintained by Prisma (@updatedAt), so no DB-level default
ALTER TABLE "SkillVerification" ALTER COLUMN "updatedAt" DROP DEFAULT;
