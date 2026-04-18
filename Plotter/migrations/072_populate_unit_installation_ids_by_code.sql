-- Migration 072: Link remaining units to installations using location field.
-- Unit location is stored as "CODE, STATE" (e.g. "HURLBURT, FL", "DAVIS MONTHAN, AZ").
-- Match by stripping spaces from the code portion and comparing to installations.code.

UPDATE units u
SET    installation_id = i.id
FROM   installations i
WHERE  u.installation_id IS NULL
  AND  u.location IS NOT NULL
  AND  u.location <> ''
  AND  REPLACE(UPPER(TRIM(SPLIT_PART(u.location, ',', 1))), ' ', '') = i.code;
