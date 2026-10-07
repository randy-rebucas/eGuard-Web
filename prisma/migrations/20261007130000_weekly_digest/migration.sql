-- The weekly summary email: when it last went out for the family
ALTER TABLE "Family" ADD COLUMN "digestSentAt" TIMESTAMP(3);
