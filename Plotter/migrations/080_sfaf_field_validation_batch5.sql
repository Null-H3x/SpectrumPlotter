-- Batch 5: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   300  Tx State/Country
--   340  Tx Equipment Nomenclature
--   343  Tx Equipment Certification Identification Number (J/F Number)
--   358  Tx Antenna Elevation
--   458  Rx Antenna Elevation

-- ── 300  Tx State/Country ─────────────────────────────────────────────────────
-- Pub7 §300: up to 4 characters. Authorized abbreviation for the state,
-- country, or geographical area where the transmitter antenna is located.
-- Mandatory on all assignments.
-- Uses standardized abbreviations from Annex C (e.g., US state codes, country
-- codes, geographic area codes: SPCE, PAC, etc.).
-- Examples: "IN", "PAC", "SPCE", "J", "GUM", "CO"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^[A-Z0-9]{1,4}$',
    validation_message = 'Tx state/country must be 1–4 uppercase alphanumeric characters using the standardized abbreviation from Annex C. Example: "IN" or "PAC".',
    example_value      = 'AL'
WHERE field_number = '300';

-- ── 340  Tx Equipment Nomenclature ───────────────────────────────────────────
-- Pub7 §340: up to 1+1+16 characters. Two-part entry: equipment type code
-- (single letter) + comma + military nomenclature or commercial make/model.
-- Type codes:
--   G = Government (standard military nomenclature)
--   C = Commercial (manufacturer code + model number)
--   U = Unassigned nomenclature
-- Blank allowed when no equipment is assigned or applicable.
-- Examples: "G,AN/GRC-103", "G,AN/GRC-212", "C,MOTH23FFN1130E", "G,T128"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([GCU],.{1,16})?$',
    validation_message = 'Equipment nomenclature must start with G (government), C (commercial), or U (unassigned) followed by a comma and the nomenclature. Example: "G,AN/GRC-212".',
    example_value      = 'G,AN/GRC-212'
WHERE field_number = '340';

-- ── 343  Tx Equipment Certification Identification Number ─────────────────────
-- Pub7 §343: up to 15 characters. MC4EB J/F 12 equipment certification number.
-- Format: up to 6-character prefix (right-justified or space-padded) + slash +
--         5-digit sequence number + optional revision (/n or /nn).
-- The 7th position is always a slash "/".
-- Approved prefixes (always exactly 6 chars, space-padded if shorter):
--   J/F 12 (non-releasable US), AC (JFLCC), CC (CENTCOM), EC (EUCOM),
--   KC (AFRICOM), PC (PACOM), SC (SOUTHCOM), DA (Defense Attaché), C/F299 (CCEB)
-- Shorter prefixes are right-padded with spaces to fill 6 chars.
-- Sequential document number (2–9) occupies position 6 of the prefix field.
-- "If known" — blank allowed.
-- Examples: "J/F 12/01234", "J/F 12/02935/2", "PC    /01234", "PC   2/07891/2"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9\/ ]{6}\/\d{5}(\/\d{1,2})?)?$',
    validation_message = 'J/F certification number must be a 6-character prefix (e.g. "J/F 12", or 2-letter command code padded with spaces) followed by a slash and 5-digit number. Example: "J/F 12/01234".',
    example_value      = 'J/F 12/01234'
WHERE field_number = '343';

-- ── 358  Tx Antenna Elevation ─────────────────────────────────────────────────
-- Pub7 §358: up to 4 characters. Site terrain elevation in meters above mean
-- sea level (AMSL) at the base of the transmitter antenna structure.
-- Required for fixed terrestrial stations at or above 29890 kHz.
-- May be omitted for mobile/experimental stations — blank allowed.
-- Example: "980"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(-?\d{1,4})?$',
    validation_message = 'Tx antenna elevation must be an integer in meters AMSL, up to 4 digits. Example: "980".',
    example_value      = '980'
WHERE field_number = '358';

-- ── 458  Rx Antenna Elevation ─────────────────────────────────────────────────
-- Pub7 §458: same format as field 358, applied to the receiver antenna.
-- Site terrain elevation in meters AMSL at the base of the receiver antenna
-- structure. Required for fixed terrestrial stations at or above 29890 kHz.
-- Blank allowed for mobile/experimental stations.
-- Example: "11"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(-?\d{1,4})?$',
    validation_message = 'Rx antenna elevation must be an integer in meters AMSL, up to 4 digits. Example: "11".',
    example_value      = '11'
WHERE field_number = '458';
