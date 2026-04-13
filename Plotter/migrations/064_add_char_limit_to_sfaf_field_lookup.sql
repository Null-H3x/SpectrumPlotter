-- Migration 064: Add char_limit to sfaf_field_lookup
-- Stores the maximum allowed character length for each lookup code value.
-- Used to enforce field-length constraints in the form and output validation.

ALTER TABLE sfaf_field_lookup
    ADD COLUMN IF NOT EXISTS char_limit INTEGER;
