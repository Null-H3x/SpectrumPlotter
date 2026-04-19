-- Batch 9: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   301  Tx Antenna Location
--   354  Tx Antenna Name
--   355  Tx Antenna Nomenclature
--   401  Rx Antenna Location
--   454  Rx Antenna Name

-- ── 301  Tx Antenna Location ──────────────────────────────────────────────────
-- Pub7 §301: up to 24 characters. Name of the city, base, or geographical area
-- where the transmitting antenna is located. Use standard abbreviations from
-- Annex C (e.g., JB for Joint Base, ARPT for Airport, MTN for Mountain).
-- If location equals field 300, the record is treated as an area assignment.
-- Uppercase alphanumeric; spaces, hyphens, commas, periods, and slashes allowed.
-- Blank allowed for area-of-operation records using field 530.
-- Examples: "TOKOROZAWA", "ANDERSEN", "FT LIBERTY", "NASPAXRV"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 ''\-,\.\/]{1,24})?$',
    validation_message = 'Tx antenna location must be up to 24 uppercase characters (letters, digits, spaces, hyphens, commas, periods, slashes). Example: "ANDERSEN" or "FT LIBERTY".',
    example_value      = 'ANDERSEN'
WHERE field_number = '301';

-- ── 354  Tx Antenna Name ──────────────────────────────────────────────────────
-- Pub7 §354: up to 10 characters. Generic name for the type of transmitter
-- antenna per NTIA Manual Annex G. Required for fixed terrestrial stations at
-- or above 29890 kHz; optional for mobile/experimental and stations below
-- 29890 kHz — blank allowed.
-- Examples: "PARABOLIC", "WHIP", "DIPOLE", "YAGI", "LOG PERIODIC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 \/\-]{1,10})?$',
    validation_message = 'Tx antenna name must be up to 10 uppercase characters (generic type per NTIA Annex G). Example: "PARABOLIC" or "WHIP".',
    example_value      = 'PARABOLIC'
WHERE field_number = '354';

-- ── 355  Tx Antenna Nomenclature ─────────────────────────────────────────────
-- Pub7 §355: up to 18 characters. Standard military nomenclature or commercial
-- manufacturer's make and model number for the transmitter antenna.
-- For commercial antennas: manufacturer code (Annex D) + model number.
-- Required except for satellite transponder antennas — blank allowed.
-- Examples: "AS102", "RCATVM000IA"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9\/\-]{1,18})?$',
    validation_message = 'Tx antenna nomenclature must be up to 18 uppercase alphanumeric characters (military designation or manufacturer code + model). Example: "AS102".',
    example_value      = 'AS102'
WHERE field_number = '355';

-- ── 401  Rx Antenna Location ──────────────────────────────────────────────────
-- Pub7 §401: up to 24 characters per receiver location. Same format as field 301
-- applied to the receiving antenna. If location equals field 400, the record is
-- treated as an area assignment for that receiver.
-- Blank allowed when no fixed receiver location is defined.
-- Examples: "OWADA", "WAHIAWA", "FINEGAYAN"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 ''\-,\.\/]{1,24})?$',
    validation_message = 'Rx antenna location must be up to 24 uppercase characters (letters, digits, spaces, hyphens, commas, periods, slashes). Example: "WAHIAWA".',
    example_value      = 'WAHIAWA'
WHERE field_number = '401';

-- ── 454  Rx Antenna Name ──────────────────────────────────────────────────────
-- Pub7 §454: up to 10 characters per receiver location. Same format as field 354
-- applied to the receiver antenna. Required for fixed terrestrial stations at or
-- above 29890 kHz; not required for mobile-to-mobile or space/earth stations.
-- Blank allowed.
-- Examples: "WHIP", "DIPOLE", "PARABOLIC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z0-9 \/\-]{1,10})?$',
    validation_message = 'Rx antenna name must be up to 10 uppercase characters (generic type per NTIA Annex G). Example: "WHIP" or "DIPOLE".',
    example_value      = 'WHIP'
WHERE field_number = '454';
