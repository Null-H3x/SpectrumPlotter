-- Add sfaf_record_type to sfafs table
-- A = Permanent Assignment, P = Permanent Proposal, S = Special Temporary, T = Temporary
ALTER TABLE sfafs
    ADD COLUMN IF NOT EXISTS sfaf_record_type CHAR(1) NOT NULL DEFAULT 'A'
        CHECK (sfaf_record_type IN ('A', 'P', 'S', 'T'));

COMMENT ON COLUMN sfafs.sfaf_record_type IS
    'A=Permanent Assignment, P=Permanent Proposal, S=Special Temporary Authorization, T=Temporary Assignment';
