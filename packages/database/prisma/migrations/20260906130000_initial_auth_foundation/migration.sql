-- Core identity, cooperative, skill, verification, and certificate foundation.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'WORKER', 'COOPERATIVE_ADMIN');
CREATE TYPE "CooperativeMembershipRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "SkillVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "CertificateStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mobile" VARCHAR(16) NOT NULL,
  "email" VARCHAR(254),
  "passwordHash" VARCHAR(255) NOT NULL,
  "refreshTokenHash" VARCHAR(255),
  "role" "UserRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Worker" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cooperative" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "registrationNo" VARCHAR(100),
  "adminUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CooperativeMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cooperativeId" UUID NOT NULL,
  "workerId" UUID NOT NULL,
  "role" "CooperativeMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CooperativeMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerSkill" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workerId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "verificationStatus" "SkillVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillVerification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workerSkillId" UUID NOT NULL,
  "verifiedById" UUID NOT NULL,
  "status" "SkillVerificationStatus" NOT NULL,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Certificate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workerSkillId" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "issuer" VARCHAR(200),
  "referenceNo" VARCHAR(150),
  "documentUrl" VARCHAR(2048),
  "status" "CertificateStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
CREATE UNIQUE INDEX "Worker_userId_key" ON "Worker"("userId");
CREATE UNIQUE INDEX "Cooperative_registrationNo_key" ON "Cooperative"("registrationNo");
CREATE INDEX "Cooperative_adminUserId_idx" ON "Cooperative"("adminUserId");
CREATE UNIQUE INDEX "CooperativeMembership_cooperativeId_workerId_key" ON "CooperativeMembership"("cooperativeId", "workerId");
CREATE INDEX "CooperativeMembership_workerId_idx" ON "CooperativeMembership"("workerId");
CREATE INDEX "CooperativeMembership_cooperativeId_role_idx" ON "CooperativeMembership"("cooperativeId", "role");
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");
CREATE UNIQUE INDEX "WorkerSkill_workerId_skillId_key" ON "WorkerSkill"("workerId", "skillId");
CREATE INDEX "WorkerSkill_verificationStatus_idx" ON "WorkerSkill"("verificationStatus");
CREATE INDEX "WorkerSkill_verifiedByUserId_idx" ON "WorkerSkill"("verifiedByUserId");
CREATE INDEX "SkillVerification_workerSkillId_createdAt_idx" ON "SkillVerification"("workerSkillId", "createdAt");
CREATE INDEX "SkillVerification_verifiedById_idx" ON "SkillVerification"("verifiedById");
CREATE INDEX "Certificate_workerSkillId_status_idx" ON "Certificate"("workerSkillId", "status");
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cooperative" ADD CONSTRAINT "Cooperative_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperativeMembership" ADD CONSTRAINT "CooperativeMembership_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CooperativeMembership" ADD CONSTRAINT "CooperativeMembership_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerSkill" ADD CONSTRAINT "WorkerSkill_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerSkill" ADD CONSTRAINT "WorkerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerSkill" ADD CONSTRAINT "WorkerSkill_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SkillVerification" ADD CONSTRAINT "SkillVerification_workerSkillId_fkey" FOREIGN KEY ("workerSkillId") REFERENCES "WorkerSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillVerification" ADD CONSTRAINT "SkillVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_workerSkillId_fkey" FOREIGN KEY ("workerSkillId") REFERENCES "WorkerSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
