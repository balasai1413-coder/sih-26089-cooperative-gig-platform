-- Stable cooperative ownership for historical booking attribution.
-- Nullable preserves existing bookings whose original cooperative cannot be
-- reconstructed safely; all new booking writes populate this snapshot.
ALTER TABLE "Booking" ADD COLUMN "cooperativeId" UUID;

CREATE INDEX "Booking_cooperativeId_status_idx" ON "Booking"("cooperativeId", "status");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_cooperativeId_fkey"
  FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
