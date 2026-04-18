-- migration 073: status log tables for tracking proposal/request history

CREATE TABLE IF NOT EXISTS assignment_status_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID        NOT NULL REFERENCES frequency_assignments(id) ON DELETE CASCADE,
    status_code     VARCHAR(50) NOT NULL,
    actor_workbox   VARCHAR(100) NOT NULL DEFAULT '',
    actor_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    target_workbox  VARCHAR(100) NOT NULL DEFAULT '',
    notes           TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asl_assignment_time
    ON assignment_status_log(assignment_id, created_at);

CREATE TABLE IF NOT EXISTS request_status_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID        NOT NULL REFERENCES frequency_requests(id) ON DELETE CASCADE,
    status_code     VARCHAR(50) NOT NULL,
    actor_workbox   VARCHAR(100) NOT NULL DEFAULT '',
    actor_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    target_workbox  VARCHAR(100) NOT NULL DEFAULT '',
    notes           TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsl_request_time
    ON request_status_log(request_id, created_at);
