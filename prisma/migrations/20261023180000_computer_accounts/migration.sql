-- Computers: which Windows accounts eGuard applies the child's rules in (the parent picks them when pairing)
ALTER TABLE "Device" ADD COLUMN "accounts" JSONB;
