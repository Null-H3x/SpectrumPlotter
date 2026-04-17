-- 070_add_installation_ism_workboxes.sql
-- Create workboxes for installation-level ISM units that have units in the units
-- table but no corresponding workbox entry. Workboxes are linked to their
-- installation via installation_id so the service can resolve them when a
-- requester selects an installation UUID from the ISM office dropdown.

INSERT INTO workboxes (name, description, installation_id, is_active)
VALUES
    ('Hurlburt Field ISM', 'Hurlburt Field installation-level ISM workbox',
     'c1d830d5-4fce-44ef-946a-83efb8440d9e', true),
    ('Cannon AFB ISM', 'Cannon Air Force Base installation-level ISM workbox',
     'a4b00d28-f8ed-4341-b20c-17ca29b803b4', true)
ON CONFLICT (name) DO NOTHING;

-- Backfill routed_to_workbox for requests that carry edit_authority_workbox =
-- 'Hurlburt Field ISM' but were never explicitly routed (pre-migration data).
UPDATE frequency_requests
SET    routed_to_workbox = edit_authority_workbox
WHERE  edit_authority_workbox = 'Hurlburt Field ISM'
  AND  routed_to_workbox IS NULL;
