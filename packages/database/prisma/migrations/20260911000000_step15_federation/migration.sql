-- Step 15: federation membership and federation administrator scope
CREATE TYPE "FederationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FederationMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT');

CREATE TABLE "Federation" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000),
    "status" "FederationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Federation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FederationMembership" (
    "id" UUID NOT NULL,
    "federationId" UUID NOT NULL,
    "cooperativeId" UUID NOT NULL,
    "status" "FederationMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FederationMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FederationAdministrator" (
    "id" UUID NOT NULL,
    "federationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FederationAdministrator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Federation_code_key" ON "Federation"("code");
CREATE INDEX "Federation_status_idx" ON "Federation"("status");
CREATE UNIQUE INDEX "FederationMembership_cooperativeId_key" ON "FederationMembership"("cooperativeId");
CREATE INDEX "FederationMembership_federationId_status_idx" ON "FederationMembership"("federationId", "status");
CREATE UNIQUE INDEX "FederationAdministrator_federationId_userId_key" ON "FederationAdministrator"("federationId", "userId");
CREATE INDEX "FederationAdministrator_userId_idx" ON "FederationAdministrator"("userId");

ALTER TABLE "FederationMembership" ADD CONSTRAINT "FederationMembership_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FederationMembership" ADD CONSTRAINT "FederationMembership_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FederationAdministrator" ADD CONSTRAINT "FederationAdministrator_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FederationAdministrator" ADD CONSTRAINT "FederationAdministrator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
