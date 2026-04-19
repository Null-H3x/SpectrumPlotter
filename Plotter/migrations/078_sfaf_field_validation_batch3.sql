-- Batch 3: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   130  Hours of Operation
--   200  Agency
--   357  Tx Antenna Gain
--   362  Tx Antenna Orientation
--   363  Tx Antenna Polarization

-- ── 130  Hours of Operation ───────────────────────────────────────────────────
-- Pub7 §130: describes when the frequency is guarded or used.
-- Frequency of use code (1–4):
--   1=constant/nearly (50–100%), 2=regular/frequent (10–50%),
--   3=intermittent (1–10%), 4=sporadic (<1%)
-- For stations below 29890 kHz the digit is followed by a time-of-day code:
--   HX=intermittent/24h, HN=night, HJ=day, H24=continuous 24h, HT=transition
-- Stations above 29890 kHz omit the time suffix (digit only).
-- Required except for records with specific IRAC notes — blank allowed.
-- Examples: "1H24", "2", "3HX", "1"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^([1-4](H(X|N|J|24|T))?)?$',
    validation_message = 'Hours of operation must be 1–4 (use frequency) optionally followed by a time code: HX, HN, HJ, H24, or HT. Example: "1H24" or "2".',
    example_value      = '1H24'
WHERE field_number = '130';

-- ── 200  Agency ───────────────────────────────────────────────────────────────
-- Pub7 §200: identifies the managing agency or service, up to 6 characters.
-- Mandatory on all assignments.
-- Standard DoD service abbreviations: USA, DON, USAF, MC, NSA, USCG, JNTSVC.
-- Operating units and subordinate designations are also permitted
-- (e.g., "24MEU", "82ABN", "8AF", "PMA266") without spaces.
-- If JNTSVC is entered, Data Item 147 must also be completed.
-- Examples: "USAF", "USA", "DON", "MC", "USCG", "NSA", "JNTSVC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^[A-Z0-9]{2,6}$',
    validation_message = 'Agency must be 2–6 uppercase alphanumeric characters with no spaces. Standard values: USA, DON, USAF, MC, NSA, USCG, JNTSVC. Example: "USAF".',
    example_value      = 'USAF'
WHERE field_number = '200';

-- ── 357  Tx Antenna Gain ──────────────────────────────────────────────────────
-- Pub7 §357: antenna gain in dBi toward maximum radiation, up to 3 characters
-- (or more with decimal). Negative gains use a leading dash; for terrestrial
-- non-fixed stations with a negative gain, enter 0 instead of the actual value.
-- Optional for many station types — blank allowed.
-- Examples: "20", "4.5", "-10", "9"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(-?\d+(\.\d+)?)?$',
    validation_message = 'Antenna gain must be a numeric dBi value, optionally negative (e.g. "-10") or decimal (e.g. "4.5"). Example: "9".',
    example_value      = '9'
WHERE field_number = '357';

-- ── 362  Tx Antenna Orientation ──────────────────────────────────────────────
-- Pub7 §362: describes physical direction or movement of the transmitter antenna.
-- Three sub-cases:
--   Terrestrial: 3-digit azimuth (000–360) or code ND/R/S/SSH/SSV/T
--   Earth station: V + 2-digit elevation + comma + 3-digit azimuth(s)
--                  two satellites: V09,133/150  range: V12,122-160
--   Space station: NB (narrow beam) or EC (earth coverage)
-- Blank allowed for records where orientation is not applicable.
-- Examples: "225", "ND", "R", "S", "SSH", "SSV", "T", "V09,133",
--           "V10,132/150", "V12,122-160", "NB", "EC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^(\d{3}|ND|R|S|SSH|SSV|T|NB|EC|V\d{2},\d{3}(\/\d{3}|-\d{3})?)?$',
    validation_message = 'Antenna orientation must be a 3-digit azimuth (000–360), a direction code (ND, R, S, SSH, SSV, T), an earth-station entry (e.g. V09,133), or a space-station code (NB, EC). Example: "ND" or "225".',
    example_value      = 'ND'
WHERE field_number = '362';

-- ── 363  Tx Antenna Polarization ─────────────────────────────────────────────
-- Pub7 §363: single character from the ITU polarization code table.
--   A=elliptic left, B=elliptic right, D=rotating, E=elliptical, F=45-degrees,
--   H=fixed horizontal, J=linear, L=left-hand circular, M=oblique angled left,
--   N=oblique angled right, O=oblique angled crossed, R=right-hand circular,
--   S=horizontal and vertical, T=right and left-hand circular,
--   V=fixed vertical, X=other/unknown
-- Conditional requirement — blank allowed.
-- Example: "V"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[ABDEFJLMNORSTVX]?$',
    validation_message = 'Antenna polarization must be a single letter: A, B, D, E, F, H, J, L, M, N, O, R, S, T, V, or X. Example: "V" (fixed vertical).',
    example_value      = 'V'
WHERE field_number = '363';
