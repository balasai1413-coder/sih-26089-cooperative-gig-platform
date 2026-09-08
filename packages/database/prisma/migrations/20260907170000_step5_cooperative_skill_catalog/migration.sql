-- Step 5: Cooperative management + skill catalog foundation.

-- CooperativeStatus enum for cooperative lifecycle.
CREATE TYPE "CooperativeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- Cooperative profile extensions.
ALTER TABLE "Cooperative" ADD COLUMN "description" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN "location" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN "operatingArea" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Cooperative" ADD COLUMN "status" "CooperativeStatus" NOT NULL DEFAULT 'ACTIVE';

-- Skill categories: controlled grouping for the shared skill catalog.
CREATE TABLE "SkillCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- Soft activation for catalog skills; historical worker skills stay intact.
ALTER TABLE "Skill" ADD COLUMN "categoryId" UUID,
                    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");
CREATE INDEX "Skill_active_idx" ON "Skill"("active");
CREATE INDEX "Cooperative_status_idx" ON "Cooperative"("status");

ALTER TABLE "SkillCategory" ADD CONSTRAINT "SkillCategory_name_key" UNIQUE ("name");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SkillCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;