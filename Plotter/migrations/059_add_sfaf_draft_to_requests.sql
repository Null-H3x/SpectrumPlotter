-- Migration 059: Add sfaf_draft JSONB column to frequency_requests.
-- Stores in-progress SFAF approval form data so workbox edits persist
-- server-side and are available to all reviewers across browsers.
ALTER TABLE frequency_requests
    ADD COLUMN IF NOT EXISTS sfaf_draft JSONB;
