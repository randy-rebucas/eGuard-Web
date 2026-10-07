-- Arrive and leave notices for saved places, off until the parents turn them on per place
ALTER TABLE "Place" ADD COLUMN "notifyArrive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifyLeave" BOOLEAN NOT NULL DEFAULT false;
