-- The web app shows a first-run intro and quick tour until the parent closes it
ALTER TABLE "User" ADD COLUMN "introSeenAt" TIMESTAMP(3);

-- Parents who already use eGuard know their way around: they can replay the tour from the profile menu
UPDATE "User" SET "introSeenAt" = "createdAt";
