-- Setup reminders (lib/setup-reminders): emails to families that never added a child (childReminders) and to families
-- that added a child but never paired a device (setupReminders). How many of each have been sent and when the last
-- went out, so each step goes once and each sequence stops after its last.
ALTER TABLE "Family" ADD COLUMN "childReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Family" ADD COLUMN "childRemindedAt" TIMESTAMP(3);
ALTER TABLE "Family" ADD COLUMN "setupReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Family" ADD COLUMN "setupRemindedAt" TIMESTAMP(3);
