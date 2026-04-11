-- Migration 057: Seed MAJCOM-level ISM workbox units.
-- These represent the MAJCOM spectrum management offices (e.g. AFSOC ISM, ACC ISM).
-- Unit names match the hardcoded workbox strings in GetWorkboxes so that
-- routed_to_workbox lookups resolve correctly for MAJCOM ISM users.
-- parent_unit_id is set to the corresponding MAJCOM unit where it exists.

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFSOC ISM',  'AFSOC-ISM',  'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFSOC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'ACC ISM',    'ACC-ISM',    'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'ACC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AETC ISM',   'AETC-ISM',   'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AETC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFDW ISM',   'AFDW-ISM',   'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFDW' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFGSC ISM',  'AFGSC-ISM',  'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFGSC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFMC ISM',   'AFMC-ISM',   'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFMC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFRC ISM',   'AFRC-ISM',   'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFRC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AFSPC ISM',  'AFSPC-ISM',  'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AFSPC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'AMC ISM',    'AMC-ISM',    'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'AMC' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'ANG ISM',    'ANG-ISM',    'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'ANG' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'PACAF ISM',  'PACAF-ISM',  'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'PACAF' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

INSERT INTO units (id, name, unit_code, unit_type, organization, parent_unit_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'USAFE ISM',  'USAFE-ISM',  'ISM', 'USAF', u.id, true, NOW(), NOW()
FROM units u WHERE u.unit_code = 'USAFE' AND u.unit_type = 'MAJCOM'
ON CONFLICT (unit_code) DO NOTHING;

-- AFC / Agency workboxes (no MAJCOM parent — top of chain)
INSERT INTO units (id, name, unit_code, unit_type, organization, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'GAFC',           'GAFC',          'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'NAFC',           'NAFC',          'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'CENTCOM AFC',    'CENTCOM-AFC',   'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'EUCOM AFC',      'EUCOM-AFC',     'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'INDOPACOM AFC',  'INDOPACOM-AFC', 'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'NORTHCOM AFC',   'NORTHCOM-AFC',  'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'SOCOM AFC',      'SOCOM-AFC',     'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'FORSCOM AFC',    'FORSCOM-AFC',   'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'USAREUR AFC',    'USAREUR-AFC',   'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'NAVEUR AFC',     'NAVEUR-AFC',    'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'NAVPAC AFC',     'NAVPAC-AFC',    'ISM', 'USAF', true, NOW(), NOW()),
    (gen_random_uuid(), 'AFSMO',          'AFSMO',         'ISM', 'USAF', true, NOW(), NOW())
ON CONFLICT (unit_code) DO NOTHING;
