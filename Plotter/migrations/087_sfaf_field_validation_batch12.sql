-- Batch 12: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   356  Tx Antenna Structure Height
--   361  Tx Antenna Vertical Beamwidth
--   456  Rx Antenna Structure Height
--   460  Rx Antenna Horizontal Beamwidth
--   461  Rx Antenna Vertical Beamwidth

-- ── 356  Tx Antenna Structure Height ─────────────────────────────────────────
-- Pub7 §356: up to 3 characters. Overall height in meters of the transmitter
-- antenna support structure above ground level. Required for EUCOM assignments;
-- optional for others. Not applicable to mobile services unless the station is
-- fixed within the mobile service. Blank allowed.
-- Example: "17"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,3})?$',
    validation_message = 'Tx antenna structure height must be a whole number in meters above ground level, up to 3 digits. Example: "17".',
    example_value      = '17'
WHERE field_number = '356';

-- ── 361  Tx Antenna Vertical Beamwidth ───────────────────────────────────────
-- Pub7 §361: up to 3 characters. Transmitter antenna vertical beamwidth in
-- degrees, measured at the half-power (-3 dB) points. Required for EUCOM
-- assignments; optional for all others. Blank allowed.
-- Example: "23"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,3})?$',
    validation_message = 'Tx antenna vertical beamwidth must be a whole number in degrees at the -3 dB points, up to 3 digits. Example: "23".',
    example_value      = '23'
WHERE field_number = '361';

-- ── 456  Rx Antenna Structure Height ─────────────────────────────────────────
-- Pub7 §456: up to 2 characters. Overall height in meters of the receiver
-- antenna support structure above ground level. Same concept as field 356 but
-- for the receive antenna; shorter field (2 chars vs 3). Required for EUCOM;
-- optional for all others. Not applicable to mobile services. Blank allowed.
-- Example: "17"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,2})?$',
    validation_message = 'Rx antenna structure height must be a whole number in meters above ground level, up to 2 digits. Example: "17".',
    example_value      = '17'
WHERE field_number = '456';

-- ── 460  Rx Antenna Horizontal Beamwidth ─────────────────────────────────────
-- Pub7 §460: up to 4 characters. Same format as field 360 (Tx Antenna
-- Horizontal Beamwidth), applied to the receiver antenna. Angular beamwidth
-- in degrees at the half-power (-3 dB) points for space/earth/terrestrial
-- stations employing earth or space-station techniques. Prefix fractional
-- values with a zero. Blank allowed for mobile/experimental stations.
-- Examples: "0.5", "12"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d+(\.\d+)?)?$',
    validation_message = 'Rx antenna horizontal beamwidth must be a positive numeric value in degrees at -3 dB points. Example: "0.5" or "12".',
    example_value      = '12'
WHERE field_number = '460';

-- ── 461  Rx Antenna Vertical Beamwidth ───────────────────────────────────────
-- Pub7 §461: up to 3 characters. Same format as field 361 (Tx Antenna Vertical
-- Beamwidth), applied to the receiver antenna. Half-power vertical beamwidth
-- in degrees. Required for EUCOM; optional for all others. Blank allowed.
-- Example: "23"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,3})?$',
    validation_message = 'Rx antenna vertical beamwidth must be a whole number in degrees at the -3 dB points, up to 3 digits. Example: "23".',
    example_value      = '23'
WHERE field_number = '461';
