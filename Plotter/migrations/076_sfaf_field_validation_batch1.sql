-- Batch 1: Add validation columns to sfaf_field_definitions and seed rules
-- for the five most strictly constrained fields from MC4EB Pub 7 CHG 1:
--   010  Type of Action
--   102  Agency Serial Number
--   110  Frequency(ies)
--   114  Emission Designator
--   115  Transmitter Power

-- ── Schema extension ──────────────────────────────────────────────────────────

ALTER TABLE sfaf_field_definitions
    ADD COLUMN IF NOT EXISTS input_type         VARCHAR(30),
    ADD COLUMN IF NOT EXISTS validation_pattern VARCHAR(500),
    ADD COLUMN IF NOT EXISTS validation_message VARCHAR(300),
    ADD COLUMN IF NOT EXISTS example_value      VARCHAR(100);

COMMENT ON COLUMN sfaf_field_definitions.input_type IS
    'Input type hint for frontend: text|number|date|select|frequency|emission|power|serial|coordinates';
COMMENT ON COLUMN sfaf_field_definitions.validation_pattern IS
    'PostgreSQL-compatible regex (also used as HTML pattern attribute). NULL = no pattern check.';
COMMENT ON COLUMN sfaf_field_definitions.validation_message IS
    'Human-readable error shown when validation_pattern fails.';
COMMENT ON COLUMN sfaf_field_definitions.example_value IS
    'Illustrative correct value shown in form placeholder / help text.';

-- ── 010  Type of Action ───────────────────────────────────────────────────────
-- Pub7 §3f: N=New, M=Modification, D=Deletion, R=Review, A=Administrative Mod
-- Single character, uppercase, from defined set only. Mandatory on all records.
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[NMDRA]$',
    validation_message = 'Type of Action must be N (New), M (Modification), D (Deletion), R (Review), or A (Administrative).',
    example_value      = 'N'
WHERE field_number = '010';

-- ── 102  Agency Serial Number ─────────────────────────────────────────────────
-- Pub7 §3b(1): exactly 10 characters. Mandatory on all records.
-- Approved prefixes: N (Navy), AR (Army), MC (USMC), CG (USCG), AF (Air Force).
-- Format: prefix left-justified in 4-char field (space-padded) + 6 decimal digits.
-- Examples: "AF  007814", "AR  733489", "N   773101"
UPDATE sfaf_field_definitions SET
    input_type         = 'serial',
    validation_pattern = '^(N   |AR  |MC  |CG  |AF  )\d{6}$',
    validation_message = 'Serial must be exactly 10 characters: approved prefix (N, AR, MC, CG, AF) left-justified in 4 chars then 6 digits. Example: "AF  007814".',
    example_value      = 'AF  007814'
WHERE field_number = '102';

-- ── 110  Frequency(ies) ───────────────────────────────────────────────────────
-- Pub7 Appendix A / §3d: stored with ITU unit prefix. Mandatory on all records.
--   K = kilohertz (KHz)
--   M = megahertz (MHz)
--   G = gigahertz (GHz)
-- Optionally followed by a reference frequency in parentheses.
-- Examples: "M122.725", "K385", "M1107", "K4726.5(4725)", "K11117.6(11116.1)"
UPDATE sfaf_field_definitions SET
    input_type         = 'frequency',
    validation_pattern = '^[KMGkmg]\d+(\.\d+)?(\(\d+(\.\d+)?\))?$',
    validation_message = 'Frequency must begin with a unit prefix (K=KHz, M=MHz, G=GHz) followed by the numeric value. Example: "M122.725" or "K385".',
    example_value      = 'M122.725'
WHERE field_number = '110';

-- ── 114  Emission Designator ──────────────────────────────────────────────────
-- ITU Radio Regulations Appendix 1 / Pub7 Appendix A.
-- Format: bandwidth (digits + unit letter H/K/M/G + 0-2 decimal digits) +
--         emission class (letter) + modulation (digit) + info type (letter) +
--         optional 2-char suffix for multiplexing/nature.
-- Max 11 characters (VARCHAR(11) in schema).
-- Required for CENTCOM; optional for others — blank allowed.
-- Examples: "6K00A3E", "11K00F3E", "100K00F1D", "100M00D7WET", "0H00N0N"
UPDATE sfaf_field_definitions SET
    input_type         = 'emission',
    validation_pattern = '^(\d{0,4}\.?\d{0,2}[HKMGhkmg]\d{0,2}[A-Z0-9]\d[A-Z0-9]([A-Z0-9]{2})?)?$',
    validation_message = 'Emission designator must follow ITU format: bandwidth (e.g. 6K, 100M) + class + modulation + info type. Example: "6K00A3E" or "100K00F1D".',
    example_value      = '6K00A3E'
WHERE field_number = '114';

-- ── 115  Transmitter Power ────────────────────────────────────────────────────
-- Pub7 Appendix A: stored with unit prefix.
--   W = watts
--   K = kilowatts
-- Required for CENTCOM; optional for others — blank allowed.
-- Examples: "W10", "W300", "K1.5", "K25", "W50"
UPDATE sfaf_field_definitions SET
    input_type         = 'power',
    validation_pattern = '^([WKwk]\d+(\.\d+)?)?$',
    validation_message = 'Transmitter power must begin with W (watts) or K (kilowatts) followed by the numeric value. Example: "W50" or "K1.5".',
    example_value      = 'W50'
WHERE field_number = '115';
