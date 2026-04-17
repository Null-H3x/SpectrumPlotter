-- 069_user_custom_views.sql
-- Persist custom SFAF views server-side, tied to the authenticated user.
-- Replaces localStorage-only storage so views survive browser clears and
-- work across devices.

CREATE TABLE IF NOT EXISTS user_custom_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    fields      JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_custom_views_user_id ON user_custom_views (user_id);
