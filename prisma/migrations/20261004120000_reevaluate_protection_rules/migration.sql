-- Data only: brings stored device statuses in line with two changes to evaluate() (src/lib/health.ts), so families
-- don't wait for each device's next report.
--   1. A protection the parent turned off passes. It used to be NOT_CONFIGURED when the device had it off too.
--   2. Web filtering compares the mode only. A device reports blockedSites as the size of its own list, which never
--      matched the policy's number, so it read WARNING.
-- Open alerts on the rows that now pass are resolved, as a passing report would do.

WITH fixed AS (
  UPDATE "DeviceProtection" dp
  SET "status" = 'PASS', "message" = NULL
  FROM "Device" d, "ChildPolicy" cp
  WHERE d."id" = dp."deviceId"
    AND cp."childId" = d."childId"
    AND cp."key" = dp."key"
    AND (
      (dp."status" = 'NOT_CONFIGURED' AND (
        (dp."key" IN ('BEDTIME', 'APP_APPROVAL', 'UNINSTALL_PROTECTION') AND (cp."config"->>'enabled')::boolean IS FALSE)
        OR (dp."key" = 'WEB' AND cp."config"->>'mode' = 'OFF')
        OR (dp."key" = 'DOWNLOADS' AND (cp."config"->>'requireApproval')::boolean IS FALSE)
        OR (dp."key" = 'LOCATION' AND (cp."config"->>'sharing')::boolean IS FALSE)
        OR (dp."key" = 'NOTIFICATIONS' AND (cp."config"->>'quietDuringBedtime')::boolean IS FALSE)
      ))
      OR (dp."status" = 'WARNING' AND dp."key" = 'WEB' AND dp."reported"->>'mode' = cp."config"->>'mode')
    )
  RETURNING dp."deviceId", dp."key"
)
UPDATE "Alert" a
SET "resolvedAt" = now()
FROM fixed
WHERE a."resolveKey" = fixed."key"::text || ':' || fixed."deviceId"
  AND a."resolvedAt" IS NULL;
