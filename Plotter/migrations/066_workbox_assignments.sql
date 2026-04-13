-- migrations/066_workbox_assignments.sql
-- Workbox multi-assignment: an ISM can belong to multiple workboxes.
-- Workboxes are anchored to an installation.

-- 1. Anchor workboxes to an installation
ALTER TABLE workboxes
    ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES installations(id) ON DELETE SET NULL;

-- 2. Many-to-many: users ↔ workboxes
CREATE TABLE IF NOT EXISTS user_workbox_assignments (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workbox_id UUID NOT NULL REFERENCES workboxes(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, workbox_id)
);

-- Only one primary workbox per user
CREATE UNIQUE INDEX IF NOT EXISTS uix_user_workbox_primary
    ON user_workbox_assignments(user_id)
    WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_user_workbox_assignments_workbox
    ON user_workbox_assignments(workbox_id);

-- 3. Migrate existing users.workbox_id → user_workbox_assignments
INSERT INTO user_workbox_assignments (user_id, workbox_id, is_primary)
SELECT id, workbox_id, true
FROM users
WHERE workbox_id IS NOT NULL
ON CONFLICT (user_id, workbox_id) DO NOTHING;

-- 4. Keep users.workbox_id for now as a cached primary reference;
--    it will be maintained in sync by the application layer going forward.
