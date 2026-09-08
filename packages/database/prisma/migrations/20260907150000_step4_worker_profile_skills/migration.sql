-- Step 4: optional worker profile data and skill-first competency verification.
-- Education and certificates remain supporting information; neither alters a
-- WorkerSkill verification state automatically.

CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE "WorkerAvailability" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE');
CREATE TYPE "VerificationMethod" AS ENUM ('PRACTICAL_ASSESSMENT', 'EXPERIENCE_EVIDENCE', 'CERTIFICATE_EVIDENCE', 'ADMIN_REVIEW');

ALTER TYPE "SkillVerificationStatus" ADD VALUE IF NOT EXISTS 'NOT_VERIFIED';
ALTER TYPE "SkillVerificationStatus" ADD VALUE IF NOT EXISTS 'ASSESSMENT_PENDING';

ALTER TABLE "Worker"
  ADD COLUMN "fullName" VARCHAR(160),
  ADD COLUMN "profilePhotoUrl" VARCHAR(2048),
  ADD COLUMN "bio" VARCHAR(1200),
  ADD COLUMN "location" VARCHAR(240),
  ADD COLUMN "educationQualification" VARCHAR(200),
  ADD COLUMN "educationInstitution" VARCHAR(240),
  ADD COLUMN "educationYear" INTEGER,
  ADD COLUMN "yearsExperience" INTEGER,
  ADD COLUMN "availability" "WorkerAvailability",
  ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "WorkerSkill"
  ADD COLUMN "proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
  ADD COLUMN "experienceYears" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "experienceSummary" VARCHAR(1000),
  ADD COLUMN "evidenceReference" VARCHAR(2048),
  ADD COLUMN "verificationRequestedAt" TIMESTAMP(3);

ALTER TABLE "SkillVerification"
  ALTER COLUMN "verifiedById" DROP NOT NULL,
  ADD COLUMN "requestedByWorkerId" UUID,
  ADD COLUMN "method" "VerificationMethod",
  ADD COLUMN "evidenceReference" VARCHAR(2048),
  ADD COLUMN "assessmentReference" VARCHAR(2048),
  ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "Certificate"
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "SkillVerification"
  ADD CONSTRAINT "SkillVerification_requestedByWorkerId_fkey"
  FOREIGN KEY ("requestedByWorkerId") REFERENCES "Worker"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SkillVerification_workerSkillId_status_idx" ON "SkillVerification"("workerSkillId", "status");
CREATE INDEX "SkillVerification_requestedByWorkerId_status_idx" ON "SkillVerification"("requestedByWorkerId", "status");
