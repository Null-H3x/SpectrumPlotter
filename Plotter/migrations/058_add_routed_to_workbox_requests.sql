-- Migration 058: Add routed_to_workbox to frequency_requests.
-- Allows ISM workboxes to route requests up the chain (base ISM → MAJCOM ISM → AFC).
-- NULL = unrouted (visible to all ISMs); non-NULL = routed to that specific workbox.
ALTER TABLE frequency_requests
    ADD COLUMN IF NOT EXISTS routed_to_workbox TEXT,
    ADD COLUMN IF NOT EXISTS edit_authority_workbox TEXT;
