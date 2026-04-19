-- Batch 10: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   209  Area AFC / DoD AFC / Other Organizations
--   440  Rx Equipment Nomenclature
--   443  Rx Equipment Certification Identification Number (J/F Number)
--   455  Rx Antenna Nomenclature
--   500  IRAC Notes

-- ── 209  Area AFC / DoD AFC / Other Organizations ────────────────────────────
-- Pub7 §209: up to 18 characters, 10 occurrences. Identifies the DoD AFC,
-- CCMD, Service Area Frequency Management Office, or other organization not
-- captured in fields 200–208. Optional — blank allowed.
-- Standard DoD AFC codes: AFCA (Arizona), WSMR (White Sands), GAFC (Gulf),
--   EAFC (Eastern/Cape Canaveral), NAFC (Nevada), WAFC (Western), USAKA (Kwajalein)
-- Examples: "JJPN", "JPAC", "AFCA", "WSMR", "GAFC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9]{1,18})?$',
    validation_message = 'Area AFC/other organization must be 1–18 uppercase alphanumeric characters. Example: "AFCA" or "JJPN".',
    example_value      = 'AFCA'
WHERE field_number = '209';

-- ── 440  Rx Equipment Nomenclature ───────────────────────────────────────────
-- Pub7 §440: same two-part format as field 340 (Tx Equipment Nomenclature),
-- applied to each receiver station location.
-- Type code + comma + military nomenclature or commercial make/model:
--   G = Government, C = Commercial, U = Unassigned
-- Blank allowed when no receiver equipment is assigned.
-- Examples: "G,AN/ARC-121", "G,AN/MPS-36MOD", "C,MOTH23FFN1130E"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([GCU],.{1,16})?$',
    validation_message = 'Rx equipment nomenclature must start with G (government), C (commercial), or U (unassigned) followed by a comma and the nomenclature. Example: "G,AN/ARC-121".',
    example_value      = 'G,AN/ARC-121'
WHERE field_number = '440';

-- ── 443  Rx Equipment Certification Identification Number ────────────────────
-- Pub7 §443: same J/F 12 certification format as field 343 (Tx Equipment
-- Certification), applied to receiver equipment. Up to 15 characters.
-- Prefix is exactly 6 characters (space-padded for shorter command codes).
-- Approved prefixes: J/F 12, AC, CC, EC, KC, PC, SC, DA, C/F299.
-- "If known" — blank allowed.
-- Examples: "J/F 12/01234", "J/F 12/02935/2", "PC    /01234", "PC   2/07891/2"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9\/ ]{6}\/\d{5}(\/\d{1,2})?)?$',
    validation_message = 'Rx J/F certification number must be a 6-character prefix (e.g. "J/F 12", or 2-letter command code padded with spaces) followed by a slash and 5-digit number. Example: "J/F 12/01234".',
    example_value      = 'J/F 12/01234'
WHERE field_number = '443';

-- ── 455  Rx Antenna Nomenclature ─────────────────────────────────────────────
-- Pub7 §455: same format as field 355 (Tx Antenna Nomenclature), applied to
-- receiver antennas. Up to 18 characters. Military nomenclature or commercial
-- manufacturer code + model number. Required except for satellite transponders.
-- Blank allowed.
-- Examples: "AS102", "RCATVM000IA"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9\/\-]{1,18})?$',
    validation_message = 'Rx antenna nomenclature must be up to 18 uppercase alphanumeric characters (military designation or manufacturer code + model). Example: "AS102".',
    example_value      = 'AS102'
WHERE field_number = '455';

-- ── 500  IRAC Notes ───────────────────────────────────────────────────────────
-- Pub7 §500: 4 characters, up to 10 occurrences. IRAC note code applicable to
-- US&P GMF assignments. Five note types, each followed by a 3-digit number:
--   C = Coordination note  (e.g. C002)
--   E = Emission note      (e.g. E001)
--   L = Limitation note    (e.g. L116)
--   P = Priority note      (e.g. P001)
--   S = Special note       (e.g. S141)
-- M (minute) notes go in field 501, not here. Blank allowed for non-GMF records.
-- Examples: "L116", "C002", "S141"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([CELPS]\d{3})?$',
    validation_message = 'IRAC note must be a note-type letter (C, E, L, P, or S) followed by a 3-digit number. Example: "L116" or "C002".',
    example_value      = 'L116'
WHERE field_number = '500';
