-- Migration 067: Deduplicate installations and add unique constraint on name
-- The installations table was seeded twice, producing ~96 duplicate rows.
-- This migration keeps the oldest row for each name, re-points FK references,
-- deletes the duplicates, and adds a unique index to prevent recurrence.

-- Re-point FKs on any remaining duplicates before deleting them
DO $$
DECLARE
    dup RECORD;
    canonical_id UUID;
    dup_id UUID;
BEGIN
    FOR dup IN
        SELECT name FROM installations GROUP BY name HAVING COUNT(*) > 1
    LOOP
        -- Canonical = earliest created_at
        SELECT id INTO canonical_id
        FROM installations WHERE name = dup.name ORDER BY created_at ASC LIMIT 1;

        FOR dup_id IN
            SELECT id FROM installations
            WHERE name = dup.name AND id <> canonical_id
        LOOP
            UPDATE account_requests SET installation_id = canonical_id WHERE installation_id = dup_id;
            UPDATE units            SET installation_id = canonical_id WHERE installation_id = dup_id;
            UPDATE users            SET installation_id = canonical_id WHERE installation_id = dup_id;
            UPDATE workboxes        SET installation_id = canonical_id WHERE installation_id = dup_id;
            DELETE FROM installations WHERE id = dup_id;
        END LOOP;
    END LOOP;
END $$;

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uix_installations_name ON installations(name);
