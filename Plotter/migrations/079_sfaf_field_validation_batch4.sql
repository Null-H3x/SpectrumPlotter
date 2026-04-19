-- Batch 4: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   140  Required Date
--   141  Expiration Date
--   142  Review Date
--   306  Tx Authorized Radius
--   406  Rx Authorized Radius

-- ── 140  Required Date ────────────────────────────────────────────────────────
-- Pub7 §140: 8 characters, YYYYMMDD format. The date the operating unit
-- requires the new assignment or modification to be operational.
-- Required for CENTCOM; optional for others — blank allowed.
-- Example: "20190101"
UPDATE sfaf_field_definitions SET
    input_type         = 'date',
    validation_pattern = '^(\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]))?$',
    validation_message = 'Required date must be 8 digits in YYYYMMDD format. Example: "20190101".',
    example_value      = '20190101'
WHERE field_number = '140';

-- ── 141  Expiration Date ──────────────────────────────────────────────────────
-- Pub7 §141: 8 characters, YYYYMMDD. The date the assignment expires.
-- Required for all temporary assignments (record type S or T); blank for
-- permanent records. Cannot coexist with Data Item 142 (Review Date).
-- Example: "20190622"
UPDATE sfaf_field_definitions SET
    input_type         = 'date',
    validation_pattern = '^(\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]))?$',
    validation_message = 'Expiration date must be 8 digits in YYYYMMDD format. Example: "20190622".',
    example_value      = '20190622'
WHERE field_number = '141';

-- ── 142  Review Date ──────────────────────────────────────────────────────────
-- Pub7 §142: 8 characters, YYYYMMDD. Date by which the permanent assignment
-- must be reviewed (normally auto-generated as approval date + 5 years).
-- Required for permanent records (type P or A) that lack an expiration date;
-- blank for temporary records. Cannot coexist with Data Item 141.
-- Example: "20230331"
UPDATE sfaf_field_definitions SET
    input_type         = 'date',
    validation_pattern = '^(\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]))?$',
    validation_message = 'Review date must be 8 digits in YYYYMMDD format. Example: "20230331".',
    example_value      = '20230331'
WHERE field_number = '142';

-- ── 306  Tx Authorized Radius ─────────────────────────────────────────────────
-- Pub7 §306: up to 5 characters. Radius in kilometers from Data Item 303
-- coordinates defining the transmitter's area of mobile operation.
-- Required suffix:
--   T = radius applies to transmitter only
--   B = radius applies to both transmitter and receiver
-- Only applies to mobile/portable stations — blank for fixed stations.
-- Examples: "30T", "150B"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^(\d{1,4}[TB])?$',
    validation_message = 'Tx authorized radius must be 1–4 digits (km) followed by a required suffix: T (transmitter only) or B (both Tx and Rx). Example: "30T" or "150B".',
    example_value      = '30T'
WHERE field_number = '306';

-- ── 406  Rx Authorized Radius ─────────────────────────────────────────────────
-- Pub7 §406: up to 4 characters. Radius in kilometers from Data Item 403
-- coordinates defining the receiver's area of mobile operation.
-- Used when Data Item 306 is blank and the receiver is portable/mobile.
-- No T/B suffix — applies to the receiver station only. Blank for fixed Rx.
-- Example: "250"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d{1,4})?$',
    validation_message = 'Rx authorized radius must be 1–4 digits representing kilometers. Example: "250".',
    example_value      = '250'
WHERE field_number = '406';
