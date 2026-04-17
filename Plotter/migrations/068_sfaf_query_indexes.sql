-- 068_sfaf_query_indexes.sql
-- Indexes to support fast Query Builder filtering on the sfafs table.
--
-- B-tree indexes support: =, <, >, <=, >=, BETWEEN, and begins-with LIKE 'value%'
-- pg_trgm GIN indexes support: contains LIKE '%value%' and exact LIKE

-- Enable trigram extension for fast contains/partial-match queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Most-queried fields: B-tree + trigram GIN ────────────────────────────────

-- 102 - Agency Serial Number (frequent exact/begins-with lookups)
CREATE INDEX IF NOT EXISTS idx_sfafs_field102 ON sfafs (field102);
CREATE INDEX IF NOT EXISTS idx_sfafs_field102_trgm ON sfafs USING GIN (field102 gin_trgm_ops);

-- 110 - Frequency (range queries, begins-with by band prefix)
CREATE INDEX IF NOT EXISTS idx_sfafs_field110 ON sfafs (field110);
CREATE INDEX IF NOT EXISTS idx_sfafs_field110_trgm ON sfafs USING GIN (field110 gin_trgm_ops);

-- 200 - Agency (begins-with and contains searches)
CREATE INDEX IF NOT EXISTS idx_sfafs_field200 ON sfafs (field200);
CREATE INDEX IF NOT EXISTS idx_sfafs_field200_trgm ON sfafs USING GIN (field200 gin_trgm_ops);

-- 300/301 - State/Country and Antenna Location
CREATE INDEX IF NOT EXISTS idx_sfafs_field300 ON sfafs (field300);
CREATE INDEX IF NOT EXISTS idx_sfafs_field301 ON sfafs (field301);
CREATE INDEX IF NOT EXISTS idx_sfafs_field301_trgm ON sfafs USING GIN (field301 gin_trgm_ops);

-- ── Commonly filtered fields: B-tree only ───────────────────────────────────

-- 113 - Station Class
CREATE INDEX IF NOT EXISTS idx_sfafs_field113 ON sfafs (field113);

-- 114 - Emission Designator
CREATE INDEX IF NOT EXISTS idx_sfafs_field114 ON sfafs (field114);

-- 144 - Approval Authority Indicator
CREATE INDEX IF NOT EXISTS idx_sfafs_field144 ON sfafs (field144);

-- 204/207 - Command / Operating Unit
CREATE INDEX IF NOT EXISTS idx_sfafs_field204 ON sfafs (field204);
CREATE INDEX IF NOT EXISTS idx_sfafs_field207 ON sfafs (field207);

-- created_at (default sort column)
CREATE INDEX IF NOT EXISTS idx_sfafs_created_at ON sfafs (created_at DESC);
