-- Step 12: Emergency booking priority support

CREATE TYPE "ServiceRequestPriority" AS ENUM ('NORMAL', 'EMERGENCY');

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'NORMAL';

CREATE INDEX IF NOT EXISTS "ServiceRequest_priority_idx"
ON "ServiceRequest"("priority");
