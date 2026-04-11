-- Migration 056: Add edit_authority_workbox to frequency_assignments.
-- Tracks which workbox currently holds edit authority over a proposal.
-- Rules:
--   - Set to the creating user's ISM unit name at record creation.
--   - Transfers when the record is distributed (routed) to another ISM workbox.
--   - Does NOT change on lateral coordination (assignment_coordinations table).
ALTER TABLE frequency_assignments
    ADD COLUMN IF NOT EXISTS edit_authority_workbox TEXT;

-- Backfill: records already routed adopt the routed-to workbox as their authority.
UPDATE frequency_assignments
SET edit_authority_workbox = routed_to_workbox
WHERE routed_to_workbox IS NOT NULL
  AND edit_authority_workbox IS NULL;
