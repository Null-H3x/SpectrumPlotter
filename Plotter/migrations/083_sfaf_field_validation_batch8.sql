-- Batch 8: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   116  Power Type
--   117  Effective Radiated Power (ERP)
--   118  Power/ERP Augmentation
--   203  Bureau
--   208  User Net/Code

-- ── 116  Power Type ───────────────────────────────────────────────────────────
-- Pub7 §116: 1 character - 20 occurrences. Power type code for the emission.
-- Interrelated with fields 113, 114, 115. Required for EUCOM and CENTCOM.
--   C = Carrier Power  (N0N and A3E broadcasting)
--   M = Mean Power     (most AM un-keyed full carrier and all FM emissions)
--   P = Peak Envelope  (all pulsed equipment, C3F TV, SSB and related classes)
-- Example: "P"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[CMP]?$',
    validation_message = 'Power type must be C (carrier), M (mean), P (peak envelope), or blank. Example: "P".',
    example_value      = 'P'
WHERE field_number = '116';

-- ── 117  Effective Radiated Power (ERP) ──────────────────────────────────────
-- Pub7 §117: up to 6 characters. Power radiated from the transmitter antenna
-- expressed in dBm (sum of transmitter power + antenna gain). Often
-- computer-generated from fields 115 and 357. Optional for most records;
-- blank is valid. Up to 6 characters allows for negative values and decimals.
-- Example: "40"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(-?\d{1,5}(\.\d)?)?$',
    validation_message = 'Effective radiated power must be a numeric dBm value, optionally negative or with one decimal place, or left blank. Example: "40".',
    example_value      = '40'
WHERE field_number = '117';

-- ── 118  Power/ERP Augmentation ───────────────────────────────────────────────
-- Pub7 §118: 1 character - 20 occurrences. Computer-generated code indicating
-- which power field was auto-populated by the system.
--   P = power field (Data Item 115) was computer-generated
--   E = ERP field (Data Item 117) was computer-generated
--   (blank) = neither field was computer-generated
-- Example: "P"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[PE]?$',
    validation_message = 'Power/ERP augmentation must be P (power computer-generated), E (ERP computer-generated), or blank. Example: "P".',
    example_value      = 'P'
WHERE field_number = '118';

-- ── 203  Bureau ───────────────────────────────────────────────────────────────
-- Pub7 §203: up to 4 characters. Identifies the Bureau for the record.
-- Required for Army (USA), USMC (MC), and Navy (DON) assignments worldwide.
-- Examples: "PA" (Army USINDOPACOM), "USMC" (Marine Corps), "USN", "ARMY"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z]{2,4})?$',
    validation_message = 'Bureau must be 2–4 uppercase letters, or blank for non-Army/USMC/Navy assignments. Example: "USMC" or "PA".',
    example_value      = 'USMC'
WHERE field_number = '203';

-- ── 208  User Net/Code ────────────────────────────────────────────────────────
-- Pub7 §208: up to 6 characters. Unique code identifying the specific user of
-- the frequency (command, activity, unit, or project). Entry format is
-- agency-directed. Only the first 5 characters are stored in GMF.
-- Required for Army and NSA records only.
-- Examples: "N53618", "ACEUS"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^[A-Z0-9]{1,6}$',
    validation_message = 'User net/code must be 1–6 uppercase alphanumeric characters. Example: "N53618" or "ACEUS".',
    example_value      = 'N53618'
WHERE field_number = '208';
