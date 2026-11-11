-- Rollback for 20261111120000_console_ops (docs/console.md). Nothing else references these tables. Run it after
-- deploying code without them, then the migration's row is removed so Prisma doesn't think it's applied:
--   psql "$DATABASE_URL" -f prisma/rollbacks/20261111120000_console_ops.down.sql
-- Flags go back to off everywhere (an unknown key is off), and the maintenance run history is lost.

BEGIN;
DROP TABLE IF EXISTS "FeatureFlag";
DROP TABLE IF EXISTS "MaintenanceRun";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261111120000_console_ops';
COMMIT;
