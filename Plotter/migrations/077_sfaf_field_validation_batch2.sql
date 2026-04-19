-- Batch 2: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   005  Security Classification
--   113  Station Class
--   144  Approval Authority Indicator
--   303  Tx Antenna Coordinates
--   403  Rx Antenna Coordinates

-- ── 005  Security Classification ─────────────────────────────────────────────
-- Pub7 §3b / Appendix A: mandatory on every transaction.
-- Part 1 (2 chars):
--   First char  = classification level: U=Unclassified, C=Confidential,
--                 S=Secret, T=Top Secret
--   Second char = special handling code: A-Z (see Pub7 §4a for full list)
-- Part 2 (optional, up to 13 chars): comma + declassification instruction:
--   DEYYYYMMDD  – declassify on specific date (8 digits)
--   DEVENT      – declassify on event (requires field 013)
--   DE25Xn...   – exempt from auto-declassification (1–9 reason codes)
-- Examples: "UE", "CE,DE20430811", "S,DEVENT", "SH,DE25X134"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[UCST][A-Z](,DE(\d{8}|VENT|25X[1-9]+))?$',
    validation_message = 'Security classification must be a 2-letter code (classification level + special handling) with an optional declassification instruction. Example: "UE" or "CE,DE20430811".',
    example_value      = 'UE'
WHERE field_number = '005';

-- ── 113  Station Class ────────────────────────────────────────────────────────
-- Pub7 Appendix A / Annex A: 2–4 uppercase letters drawn from the ITU/NTIA
-- station class symbol list (FA, FX, FB, ML, MA, BC, AL, FX, FXD, FLEA, etc.).
-- The suffix R may be appended to denote a repeater station in certain bands,
-- keeping the total within 4 characters (e.g. FXR, FBR).
-- Up to 20 occurrences allowed (one per emission group).
-- Required for CENTCOM; optional for others — blank allowed.
-- Examples: "FX", "FA", "ML", "MLP", "FXR"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([A-Z]{2,4})?$',
    validation_message = 'Station class must be 2–4 uppercase letters drawn from the NTIA/ITU station class symbol list. Example: "FX" (Fixed Station) or "ML" (Land Mobile Station).',
    example_value      = 'FX'
WHERE field_number = '113';

-- ── 144  Approval Authority Indicator ────────────────────────────────────────
-- Pub7 §144: required on all DoD transactions. Single character.
--   Y – Process through IRAC
--   U – Inside US&P; not processed through IRAC
--   O – Outside US&P (OUS&P); not processed through IRAC
--   N – Existing IRAC record, but this transaction not processed through IRAC
--       (used with Type of Action = A / Administrative Modification)
-- Example: "Y"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[YUON]$',
    validation_message = 'Approval Authority Indicator must be Y (IRAC), U (US&P non-IRAC), O (OUS&P), or N (Admin Mod of IRAC record).',
    example_value      = 'Y'
WHERE field_number = '144';

-- ── 303  Tx Antenna Coordinates ───────────────────────────────────────────────
-- Pub7 §303: WGS-84 latitude/longitude in DMS format, exactly 15 characters.
-- Format: DDMMSSn DDD MMSSd
--   DDMMSS  = 6 digits for latitude  (degrees 00–90, minutes 00–59, seconds 00–59)
--   [NS]    = hemisphere indicator for latitude
--   DDDMMSS = 7 digits for longitude (degrees 000–180, minutes 00–59, seconds 00–59)
--   [EW]    = hemisphere indicator for longitude
-- Leading zeros are required. If seconds are unknown, enter 00.
-- Not applicable for area-of-operation sites — blank allowed.
-- Examples: "214216N1171039W", "134901N1453330E", "000000N1750000E"
UPDATE sfaf_field_definitions SET
    input_type         = 'coordinates',
    validation_pattern = '^(\d{6}[NS]\d{7}[EW])?$',
    validation_message = 'Tx coordinates must be exactly 15 characters: 6-digit latitude (DDMMSS) + N or S + 7-digit longitude (DDDMMSS) + E or W. Example: "214216N1171039W".',
    example_value      = '214216N1171039W'
WHERE field_number = '303';

-- ── 403  Rx Antenna Coordinates ───────────────────────────────────────────────
-- Same 15-character WGS-84 DMS format as field 303 (Tx Antenna Coordinates),
-- applied to the receive antenna location. Blank allowed when no fixed Rx site.
-- Examples: "354645N1393254E", "212529N1580540W"
UPDATE sfaf_field_definitions SET
    input_type         = 'coordinates',
    validation_pattern = '^(\d{6}[NS]\d{7}[EW])?$',
    validation_message = 'Rx coordinates must be exactly 15 characters: 6-digit latitude (DDMMSS) + N or S + 7-digit longitude (DDDMMSS) + E or W. Example: "354645N1393254E".',
    example_value      = '354645N1393254E'
WHERE field_number = '403';
