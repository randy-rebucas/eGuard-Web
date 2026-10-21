-- Rollback for 20261021121155_parent_care and 20261021122044_parent_care_message_params
-- (docs/features/parent-care.md › Rollback).
-- Only the parent-care tables: nothing else references them. Run it after deploying code without the feature,
-- then remove the migration's row so Prisma doesn't think it's applied:
--   psql "$DATABASE_URL" -f prisma/rollbacks/20261021121155_parent_care.down.sql
-- This deletes parent-care preferences, consent timestamps and history for good: export them first if needed.

BEGIN;
DROP TABLE IF EXISTS "ParentCareMessage";
DROP TABLE IF EXISTS "ParentCareJob";
DROP TABLE IF EXISTS "ParentCareEnrollment";
DROP TABLE IF EXISTS "ParentCareAutomation";
DROP TABLE IF EXISTS "ParentCareEvent";
DROP TABLE IF EXISTS "ParentCareActivity";
DROP TABLE IF EXISTS "ParentCarePlan";
DROP TABLE IF EXISTS "ParentCareSuppression";
DROP TABLE IF EXISTS "ParentCarePreference";
DELETE FROM "_prisma_migrations" WHERE migration_name IN ('20261021121155_parent_care', '20261021122044_parent_care_message_params');
COMMIT;
