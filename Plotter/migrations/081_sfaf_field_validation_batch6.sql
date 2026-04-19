-- Batch 6: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   201  Unified Command
--   202  Unified Command Service (MAJCOM)
--   359  Tx Antenna Feed Point Height
--   400  Rx State/Country
--   459  Rx Antenna Feed Point Height

-- ── 201  Unified Command ──────────────────────────────────────────────────────
-- Pub7 §201: up to 12 characters (field is listed as 8 chars but standard CCMD
-- abbreviations such as USINDOPACOM exceed that). Identifies the unified command
-- or designated representative for the area where the assignment will be used.
-- Required for OUS&P assignments; blank allowed for CONUS assignments.
-- Standard CCMDs: USINDOPACOM, EUCOM, SOUTHCOM, CENTCOM, NORTHCOM, AFRICOM,
--                 USSTRATCOM
-- Examples: "USINDOPACOM", "EUCOM", "SOUTHCOM"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{2,12})?$',
    validation_message = 'Unified command must be 2–12 uppercase alphanumeric characters. Standard values: USINDOPACOM, EUCOM, SOUTHCOM, CENTCOM, NORTHCOM, AFRICOM, USSTRATCOM. Example: "EUCOM".',
    example_value      = 'EUCOM'
WHERE field_number = '201';

-- ── 202  Unified Command Service (MAJCOM) ─────────────────────────────────────
-- Pub7 §202: up to 8 characters. Identifies the service-level MAJCOM or
-- specified/unified command with operational control of the installation
-- where the transmitter is located. Optional — blank allowed.
-- Examples: "PACAF", "FORSCOM", "ACC", "AMC", "AFSOC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{2,8})?$',
    validation_message = 'Unified command service (MAJCOM) must be 2–8 uppercase alphanumeric characters. Example: "PACAF" or "FORSCOM".',
    example_value      = 'PACAF'
WHERE field_number = '202';

-- ── 359  Tx Antenna Feed Point Height ────────────────────────────────────────
-- Pub7 §359: up to 5 characters. Distance in meters from the terrain to the
-- transmitter antenna feedpoint. Required for terrestrial stations at or above
-- 29890 kHz; may be omitted for experimental or mobile/transportable stations.
-- Blank allowed.
-- Example: "10"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,5})?$',
    validation_message = 'Tx antenna feed point height must be a whole number in meters, up to 5 digits. Example: "10".',
    example_value      = '10'
WHERE field_number = '359';

-- ── 400  Rx State/Country ─────────────────────────────────────────────────────
-- Pub7 §400: up to 4 characters. Same format as field 300 (Tx State/Country),
-- applied to the receiving antenna location. Authorized abbreviation from
-- Annex C for the state, country, or geographical area of the receiver.
-- Blank allowed when no fixed receiver location is defined.
-- Examples: "NC", "TN", "SPCE", "J", "GUM"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{1,4})?$',
    validation_message = 'Rx state/country must be 1–4 uppercase alphanumeric characters using the standardized abbreviation from Annex C. Example: "NC" or "SPCE".',
    example_value      = 'NC'
WHERE field_number = '400';

-- ── 459  Rx Antenna Feed Point Height ────────────────────────────────────────
-- Pub7 §459: same format as field 359, applied to the receiver antenna.
-- Distance in meters from terrain to the receiver antenna feedpoint.
-- Required for fixed terrestrial stations at or above 29890 kHz. Blank allowed.
-- Example: "10"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,5})?$',
    validation_message = 'Rx antenna feed point height must be a whole number in meters, up to 5 digits. Example: "10".',
    example_value      = '10'
WHERE field_number = '459';
