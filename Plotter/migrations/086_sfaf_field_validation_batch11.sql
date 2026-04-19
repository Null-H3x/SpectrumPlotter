-- Batch 11: Seed validation rules for five fields from MC4EB Pub 7 CHG 1:
--   360  Tx Antenna Horizontal Beamwidth
--   408  Repeater Indicator
--   457  Rx Antenna Gain
--   462  Rx Antenna Orientation
--   463  Rx Antenna Polarization

-- ── 360  Tx Antenna Horizontal Beamwidth ─────────────────────────────────────
-- Pub7 §360: up to 4 characters. Angular beamwidth in degrees at the half-power
-- (-3 dB) points for space, earth, or terrestrial station antennas employing
-- earth or space-station techniques. For fractional beamwidths prefix the
-- decimal with a zero. Blank allowed for stations not using these techniques.
-- Examples: "0.5", "12", "17.2"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(\d+(\.\d+)?)?$',
    validation_message = 'Tx antenna horizontal beamwidth must be a positive numeric value in degrees at -3 dB points. Example: "17.2" or "12".',
    example_value      = '17.2'
WHERE field_number = '360';

-- ── 408  Repeater Indicator ───────────────────────────────────────────────────
-- Pub7 §408: 1 character per receiver location. Applicable only between
-- 29890 kHz and 420 MHz. Enter "R" when a fixed or mobile service station
-- is used primarily as a repeater (direct coupling Rx→Tx to retransmit as-is).
-- Blank for all non-repeater stations.
-- Example: "R"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^R?$',
    validation_message = 'Repeater indicator must be R (repeater) or blank. Applicable only between 29890 kHz and 420 MHz.',
    example_value      = 'R'
WHERE field_number = '408';

-- ── 457  Rx Antenna Gain ──────────────────────────────────────────────────────
-- Pub7 §457: same format as field 357 (Tx Antenna Gain), applied to each
-- receiver antenna. dBi in the direction of maximum radiation. Negative gains
-- are entered with a leading dash for earth/space stations only; use 0 for
-- terrestrial stations with negative gain. Blank allowed for mobile/experimental
-- stations and stations below 29890 kHz.
-- Examples: "-27", "4.5", "0"
UPDATE sfaf_field_definitions SET
    input_type         = 'number',
    validation_pattern = '^(-?\d+(\.\d+)?)?$',
    validation_message = 'Rx antenna gain must be a numeric dBi value, optionally negative or decimal. Example: "4.5" or "-27".',
    example_value      = '4.5'
WHERE field_number = '457';

-- ── 462  Rx Antenna Orientation ───────────────────────────────────────────────
-- Pub7 §462: same format as field 362 (Tx Antenna Orientation), applied to
-- each receiver antenna. Three sub-cases:
--   Terrestrial: 3-digit azimuth (000–360) or code ND/R/S/SSH/SSV/T
--   Earth station: V + 2-digit elevation + comma + 3-digit azimuth(s)
--   Space station: NB (narrow beam) or EC (earth coverage)
-- Blank allowed where orientation is not applicable.
-- Examples: "225", "ND", "V09,133", "EC"
UPDATE sfaf_field_definitions SET
    input_type         = 'text',
    validation_pattern = '^(\d{3}|ND|R|S|SSH|SSV|T|NB|EC|V\d{2},\d{3}(\/\d{3}|-\d{3})?)?$',
    validation_message = 'Rx antenna orientation must be a 3-digit azimuth (000–360), a direction code (ND, R, S, SSH, SSV, T), an earth-station entry (e.g. V09,133), or a space-station code (NB, EC). Example: "ND" or "225".',
    example_value      = 'ND'
WHERE field_number = '462';

-- ── 463  Rx Antenna Polarization ─────────────────────────────────────────────
-- Pub7 §463: same 1-character ITU polarization code as field 363 (Tx Antenna
-- Polarization), applied to each receiver antenna. Conditional requirement —
-- blank allowed.
--   A=elliptic left, B=elliptic right, D=rotating, E=elliptical, F=45-degrees,
--   H=fixed horizontal, J=linear, L=left-hand circular, M=oblique angled left,
--   N=oblique angled right, O=oblique angled crossed, R=right-hand circular,
--   S=horizontal and vertical, T=right and left-hand circular,
--   V=fixed vertical, X=other/unknown
-- Example: "V"
UPDATE sfaf_field_definitions SET
    input_type         = 'select',
    validation_pattern = '^[ABDEFJLMNORSTVX]?$',
    validation_message = 'Rx antenna polarization must be a single letter: A, B, D, E, F, H, J, L, M, N, O, R, S, T, V, or X. Example: "V" (fixed vertical).',
    example_value      = 'V'
WHERE field_number = '463';
