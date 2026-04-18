-- Migration 071: Populate installation_id on units from existing records.
--
-- Pass 1: ISM units whose names follow "<Installation Name> ISM" → match directly.
-- Pass 2: Non-ISM units whose location field contains an installation name.
-- Both passes skip units that already have an installation_id set.

-- Pass 1: ISM units  (e.g. "Hurlburt Field ISM" → installation "Hurlburt Field")
UPDATE units u
SET    installation_id = i.id
FROM   installations i
WHERE  u.unit_type = 'ISM'
  AND  u.installation_id IS NULL
  AND  u.name = i.name || ' ISM';

-- Pass 2: All remaining units with a location that contains an installation name.
-- Uses longest-match ordering so "Joint Base San Antonio" beats "San Antonio".
UPDATE units u
SET    installation_id = match.id
FROM (
    SELECT DISTINCT ON (u2.id)
           u2.id  AS unit_id,
           i2.id  AS id
    FROM   units         u2
    JOIN   installations i2
           ON u2.location ILIKE '%' || i2.name || '%'
    WHERE  u2.installation_id IS NULL
      AND  u2.location IS NOT NULL
      AND  u2.location <> ''
    ORDER  BY u2.id,
              length(i2.name) DESC   -- prefer the most-specific (longest) match
) match
WHERE  u.id = match.unit_id;
