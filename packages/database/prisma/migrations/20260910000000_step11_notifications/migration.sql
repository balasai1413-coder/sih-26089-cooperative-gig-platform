-- Step 11: Notifications & Communication
-- CreateNotificationType enum and Notification model

-- CreateEnum for NotificationType
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_STARTED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REVIEW_RECEIVED');

-- CreateTable Notification
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipientUserId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "eventKey" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for unique eventKey (idempotency)
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");

-- Indexes for common queries
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt");
CREATE INDEX "Notification_recipientUserId_readAt_idx" ON "Notification"("recipientUserId", "readAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
