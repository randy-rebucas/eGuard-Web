-- More setup reminders (lib/setup-reminders), each recording what was sent so it goes once:
-- * Child.setupReminders: the family has a device, but this child has none
-- * Child.browserNudgedAt: this child's phone is paired, but no browser is
-- * Device.setupNudgedAt: a protection on this phone never started working after pairing
ALTER TABLE "Child" ADD COLUMN "setupReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Child" ADD COLUMN "setupRemindedAt" TIMESTAMP(3);
ALTER TABLE "Child" ADD COLUMN "browserNudgedAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN "setupNudgedAt" TIMESTAMP(3);
