-- CreateEnum
CREATE TYPE "WelfareProgramType" AS ENUM ('INSURANCE', 'HEALTH_SUPPORT', 'EMERGENCY_SUPPORT', 'BENEFIT');

-- CreateEnum
CREATE TYPE "WelfareProgramStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WelfareEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WelfareClaimType" AS ENUM ('MEDICAL', 'EMERGENCY', 'FAMILY_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "WelfareClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_ENROLLMENT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_ENROLLMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_ENROLLMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_CLAIM_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_CLAIM_IN_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_CLAIM_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_CLAIM_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_CLAIM_PAID';

-- CreateTable
CREATE TABLE "WelfareProgram" (
    "id" UUID NOT NULL,
    "cooperativeId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" VARCHAR(2000),
    "type" "WelfareProgramType" NOT NULL,
    "providerName" VARCHAR(180),
    "coverageAmount" INTEGER,
    "premiumAmount" INTEGER,
    "eligibilityConfig" JSONB,
    "status" "WelfareProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelfareProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerBenefitEnrollment" (
    "id" UUID NOT NULL,
    "welfareProgramId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "status" "WelfareEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(500),
    "cancellationReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerBenefitEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelfareClaim" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "type" "WelfareClaimType" NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "amountRequested" INTEGER,
    "status" "WelfareClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" VARCHAR(500),
    "evidenceMeta" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelfareClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WelfareProgram_cooperativeId_idx" ON "WelfareProgram"("cooperativeId");

-- CreateIndex
CREATE INDEX "WelfareProgram_status_startDate_idx" ON "WelfareProgram"("status", "startDate");

-- CreateIndex
CREATE INDEX "WelfareProgram_cooperativeId_status_idx" ON "WelfareProgram"("cooperativeId", "status");

-- CreateIndex
CREATE INDEX "WorkerBenefitEnrollment_workerId_status_idx" ON "WorkerBenefitEnrollment"("workerId", "status");

-- CreateIndex
CREATE INDEX "WorkerBenefitEnrollment_welfareProgramId_status_idx" ON "WorkerBenefitEnrollment"("welfareProgramId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerBenefitEnrollment_welfareProgramId_workerId_key" ON "WorkerBenefitEnrollment"("welfareProgramId", "workerId");

-- CreateIndex
CREATE INDEX "WelfareClaim_workerId_status_idx" ON "WelfareClaim"("workerId", "status");

-- CreateIndex
CREATE INDEX "WelfareClaim_enrollmentId_status_idx" ON "WelfareClaim"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "WelfareClaim_status_idx" ON "WelfareClaim"("status");

-- AddForeignKey
ALTER TABLE "WelfareProgram" ADD CONSTRAINT "WelfareProgram_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerBenefitEnrollment" ADD CONSTRAINT "WorkerBenefitEnrollment_welfareProgramId_fkey" FOREIGN KEY ("welfareProgramId") REFERENCES "WelfareProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerBenefitEnrollment" ADD CONSTRAINT "WorkerBenefitEnrollment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "WorkerBenefitEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelfareClaim" ADD CONSTRAINT "WelfareClaim_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

