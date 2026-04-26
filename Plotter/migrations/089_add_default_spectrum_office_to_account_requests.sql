-- Migration 089: Add default spectrum office (206 workbox) to account requests
ALTER TABLE account_requests
    ADD COLUMN IF NOT EXISTS default_spectrum_office_id UUID REFERENCES units(id) ON DELETE SET NULL;

COMMENT ON COLUMN account_requests.default_spectrum_office_id IS
    'The ISM spectrum office (206 workbox) this account should default to for frequency request routing';
