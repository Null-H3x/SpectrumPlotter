-- Batch 13: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   131  Percent Time
--   506  Paired Frequency
--   511  Major Function Identifier
--   512  Intermediate Function Identifier
--   513  Detailed Function Identifier

-- ── 131  Percent Time ─────────────────────────────────────────────────────────
-- Pub7 §131: up to 2 characters. Percentage of time the transmitter is in use
-- during scheduled hours of operation (1–99). Required for EUCOM Germany
-- assignments; optional for all others. Blank allowed.
-- Example: "50"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,2})?$',
    validation_message = 'Percent time must be a 1–2 digit whole number (1–99) representing percentage of scheduled use. Example: "50".',
    example_value      = '50'
WHERE field_number = '131';

-- ── 506  Paired Frequency ─────────────────────────────────────────────────────
-- Pub7 §506: three-part field. Mandatory for repeater assignments and CENTCOM
-- point-to-point assignments; optional for duplex/frequency diversity.
-- Part 1: paired frequency in field 110 format (K/M/G prefix + numeric value)
-- Part 2: agency serial number of the associated record (field 102 format)
-- Part 3: relationship comment — one of:
--   RPT OUT      = paired frequency is the repeater transmit frequency
--   RPT IN       = paired frequency is the repeater receive frequency
--   DUPX PAIRING = duplex operation pairing
--   FREQ DIVRSTY = frequency diversity operation
-- Examples: "M163.4375,AR  097124,RPT OUT"
--           "M173.4375,AR  097123,RPT IN"
--           "M174.0000,AR  010625,DUPX PAIRING"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([KMGkmg]\d+(\.\d+)?,[A-Z ]{1,4}\d{6},(RPT OUT|RPT IN|DUPX PAIRING|FREQ DIVRSTY))?$',
    validation_message = 'Paired frequency must be: frequency (e.g. M163.4375) + comma + serial number (e.g. AR  097124) + comma + comment (RPT OUT, RPT IN, DUPX PAIRING, or FREQ DIVRSTY).',
    example_value      = 'M163.4375,AR  097124,RPT OUT'
WHERE field_number = '506';

-- ── 511  Major Function Identifier ───────────────────────────────────────────
-- Pub7 §511: up to 30 characters. Identifies the primary function of the
-- frequency assignment. Required for all DoD assignments. Entries must be
-- selected from the MC4EB-approved list in Annex G; new entries require
-- SO PWG approval. Blank allowed for legacy records predating the requirement.
-- Examples: "AIR OPERATIONS", "GROUND OPERATIONS", "C3"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 \-\/]{1,30})?$',
    validation_message = 'Major function identifier must be up to 30 uppercase characters from the MC4EB Annex G approved list. Example: "AIR OPERATIONS" or "C3".',
    example_value      = 'AIR OPERATIONS'
WHERE field_number = '511';

-- ── 512  Intermediate Function Identifier ────────────────────────────────────
-- Pub7 §512: up to 30 characters. Identifies the intermediate function
-- subordinate to the major function (field 511). Required for all DoD
-- assignments. MC4EB Annex G approved entries only.
-- Blank allowed for legacy records.
-- Examples: "AIR TRAFFIC CONTROL", "INFANTRY", "DATA LINK"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 \-\/]{1,30})?$',
    validation_message = 'Intermediate function identifier must be up to 30 uppercase characters from the MC4EB Annex G approved list. Example: "AIR TRAFFIC CONTROL" or "DATA LINK".',
    example_value      = 'AIR TRAFFIC CONTROL'
WHERE field_number = '512';

-- ── 513  Detailed Function Identifier ────────────────────────────────────────
-- Pub7 §513: up to 30 characters, 5 occurrences. Identifies the detailed
-- function subordinate to the intermediate function (field 512). Required only
-- when the identifier is listed in Annex G; blank allowed for functions without
-- a defined detailed level.
-- Examples: "GROUND CONTROL", "AIRBORNE INFANTRY", "TADIL-C", "JTIDS/MIDS"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 \-\/]{1,30})?$',
    validation_message = 'Detailed function identifier must be up to 30 uppercase characters from the MC4EB Annex G approved list. Example: "GROUND CONTROL" or "TADIL-C".',
    example_value      = 'GROUND CONTROL'
WHERE field_number = '513';
