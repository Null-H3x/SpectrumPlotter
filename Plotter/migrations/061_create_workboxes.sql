-- 061_create_workboxes.sql
-- Formal workboxes table replaces the hardcoded list and units with unit_type='ISM'.
-- ISM+ users are identified by workbox_id, not by unit membership.

CREATE TABLE IF NOT EXISTS workboxes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from the existing hardcoded list
INSERT INTO workboxes (name, description) VALUES
    -- Agency
    ('AFSMO',          'Air Force Spectrum Management Office'),
    -- AF MAJCOMs
    ('ACC ISM',        'Air Combat Command ISM'),
    ('AETC ISM',       'Air Education and Training Command ISM'),
    ('AFDW ISM',       'Air Force District of Washington ISM'),
    ('AFGSC ISM',      'Air Force Global Strike Command ISM'),
    ('AFMC ISM',       'Air Force Materiel Command ISM'),
    ('AFRC ISM',       'Air Force Reserve Command ISM'),
    ('AFSOC ISM',      'Air Force Special Operations Command ISM'),
    ('AFSPC ISM',      'Air Force Space Command ISM'),
    ('AMC ISM',        'Air Mobility Command ISM'),
    ('ANG ISM',        'Air National Guard ISM'),
    ('PACAF ISM',      'Pacific Air Forces ISM'),
    ('USAFE ISM',      'US Air Forces in Europe ISM'),
    -- Area Frequency Coordinators
    ('GAFC',           'Gulf Area Frequency Coordinator'),
    ('NAFC',           'National Area Frequency Coordinator'),
    ('CENTCOM AFC',    'CENTCOM Area Frequency Coordinator'),
    ('EUCOM AFC',      'EUCOM Area Frequency Coordinator'),
    ('INDOPACOM AFC',  'INDOPACOM Area Frequency Coordinator'),
    ('NORTHCOM AFC',   'NORTHCOM Area Frequency Coordinator'),
    ('SOCOM AFC',      'SOCOM Area Frequency Coordinator'),
    -- Joint/Other
    ('FORSCOM AFC',    'FORSCOM Area Frequency Coordinator'),
    ('USAREUR AFC',    'US Army Europe Area Frequency Coordinator'),
    ('NAVEUR AFC',     'Naval Forces Europe Area Frequency Coordinator'),
    ('NAVPAC AFC',     'Naval Forces Pacific Area Frequency Coordinator')
ON CONFLICT (name) DO NOTHING;

-- Add workbox_id to users (replaces the loose default_ism_office string)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS workbox_id UUID REFERENCES workboxes(id) ON DELETE SET NULL;

-- Migrate existing default_ism_office values to workbox_id
UPDATE users u
SET workbox_id = w.id
FROM workboxes w
WHERE u.default_ism_office = w.name
  AND u.workbox_id IS NULL;

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_users_workbox_id ON users(workbox_id);
