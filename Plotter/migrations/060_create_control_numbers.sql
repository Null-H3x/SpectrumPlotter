-- 060_create_control_numbers.sql
-- Reference table for 702 Control/Request Numbers and their descriptions.

CREATE TABLE IF NOT EXISTS control_numbers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number      TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_control_numbers_number ON control_numbers(number);
