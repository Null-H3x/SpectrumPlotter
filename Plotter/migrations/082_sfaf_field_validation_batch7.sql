-- Batch 7: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   204  Command
--   205  Subcommand
--   206  Installation Frequency Manager
--   207  Operating Unit
--   304  Call Sign

-- ── 204  Command ──────────────────────────────────────────────────────────────
-- Pub7 §204: up to 18 characters. The Major Command or applicable organization
-- subordinate to the agency (field 200) responsible for frequency management.
-- Mandatory on all assignments.
-- Examples: "ACC", "TRADOC", "FORSCOM", "PACAF"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^[A-Z0-9]{1,18}$',
    validation_message = 'Command must be 1–18 uppercase alphanumeric characters with no spaces. Example: "ACC" or "TRADOC".',
    example_value      = 'ACC'
WHERE field_number = '204';

-- ── 205  Subcommand ───────────────────────────────────────────────────────────
-- Pub7 §205: up to 18 characters. The frequency management level between the
-- command (field 204) and the installation frequency manager (field 206).
-- Optional — blank allowed.
-- Examples: "5AF", "13AF", "7AF", "18ABWG"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{1,18})?$',
    validation_message = 'Subcommand must be 1–18 uppercase alphanumeric characters with no spaces. Example: "5AF".',
    example_value      = '5AF'
WHERE field_number = '205';

-- ── 206  Installation Frequency Manager ──────────────────────────────────────
-- Pub7 §206: up to 18 characters. The station, base, installation, or
-- fort-level frequency management office for the operating unit's location.
-- Optional ("when it exists") — blank allowed.
-- Examples: "ANDREWS", "LIBERTY", "NASPAXRV", "475ABW", "3CSG"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{1,18})?$',
    validation_message = 'Installation frequency manager must be 1–18 uppercase alphanumeric characters with no spaces. Example: "ANDREWS".',
    example_value      = 'ANDREWS'
WHERE field_number = '206';

-- ── 207  Operating Unit ───────────────────────────────────────────────────────
-- Pub7 §207: up to 18 characters, 10 occurrences. Short name or designation of
-- the organization using the frequency assignment. Mandatory on all assignments.
-- Examples: "602TCW", "SUBRON18", "517ARTY", "1956CG", "388SW"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^[A-Z0-9]{1,18}$',
    validation_message = 'Operating unit must be 1–18 uppercase alphanumeric characters with no spaces. Example: "602TCW" or "SUBRON18".',
    example_value      = '602TCW'
WHERE field_number = '207';

-- ── 304  Call Sign ────────────────────────────────────────────────────────────
-- Pub7 §304: up to 10 characters. The international call sign assigned to the
-- transmitting station, or the NAVAIDS identifier for navigational aids.
-- Leave blank for local voice or tactical call signs — blank allowed.
-- Only the first 8 characters are stored in the GMF.
-- Examples: "WUH55", "AVV"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{2,10})?$',
    validation_message = 'Call sign must be 2–10 uppercase alphanumeric characters. Example: "WUH55".',
    example_value      = 'WUH55'
WHERE field_number = '304';
