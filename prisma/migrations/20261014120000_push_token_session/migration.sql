-- A push token remembers the sign-in that registered it, so signing that session out stops its alerts
ALTER TABLE "PushToken" ADD COLUMN "sessionId" TEXT;

CREATE INDEX "PushToken_sessionId_idx" ON "PushToken"("sessionId");

ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
