-- Step 4: practical work history and evidence references.
-- These records support competency review only; neither changes a skill's
-- verification status outside the authorized verification workflow.

CREATE TYPE "SkillEvidenceType" AS ENUM (
  'PRACTICAL_EXPERIENCE',
  'WORK_SAMPLE',
  'ASSESSMENT',
  'TRAINING',
  'CERTIFICATE',
  'EMPLOYER_OR_CLIENT',
  'OTHER'
);

CREATE TABLE "WorkerExperience" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workerId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "organization" VARCHAR(200),
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "description" VARCHAR(1200),
  "relevantSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillEvidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workerSkillId" UUID NOT NULL,
  "experienceId" UUID,
  "type" "SkillEvidenceType" NOT NULL,
  "description" VARCHAR(1200) NOT NULL,
  "referenceUrl" VARCHAR(2048),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SkillEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerExperience_workerId_startDate_idx" ON "WorkerExperience"("workerId", "startDate");
CREATE INDEX "SkillEvidence_workerSkillId_createdAt_idx" ON "SkillEvidence"("workerSkillId", "createdAt");
CREATE INDEX "SkillEvidence_experienceId_idx" ON "SkillEvidence"("experienceId");

ALTER TABLE "WorkerExperience"
  ADD CONSTRAINT "WorkerExperience_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillEvidence"
  ADD CONSTRAINT "SkillEvidence_workerSkillId_fkey"
  FOREIGN KEY ("workerSkillId") REFERENCES "WorkerSkill"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillEvidence"
  ADD CONSTRAINT "SkillEvidence_experienceId_fkey"
  FOREIGN KEY ("experienceId") REFERENCES "WorkerExperience"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
