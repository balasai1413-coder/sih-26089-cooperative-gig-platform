-- Step 8: Booking & Worker Assignment
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_WORKER_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_WORKER_ACCEPTANCE',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "customerNotes" VARCHAR(1000),
    "workerNotes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_workerId_idx" ON "Booking"("workerId");

-- CreateIndex
CREATE INDEX "Booking_serviceRequestId_idx" ON "Booking"("serviceRequestId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- Concurrency / Duplicate active booking protection: partial unique index
CREATE UNIQUE INDEX "unique_active_booking_per_request" ON "Booking" ("serviceRequestId") WHERE status IN ('PENDING_WORKER_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS');

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

