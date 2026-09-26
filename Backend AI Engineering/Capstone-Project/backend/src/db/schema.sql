CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- TENANTS
-- ============================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_tenant_id
    ON users(tenant_id);


-- ============================================================
-- WIDGETS
-- ============================================================

CREATE TABLE widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'lead_capture',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT widgets_version_positive CHECK (version > 0)
);

CREATE INDEX idx_widgets_tenant_id
    ON widgets(tenant_id);

CREATE INDEX idx_widgets_tenant_active
    ON widgets(tenant_id, active);


-- ============================================================
-- SUBMISSIONS
-- ============================================================

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    widget_id UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,

    payload JSONB NOT NULL,

    ip_address INET,
    user_agent TEXT,
    origin TEXT,

    country_code VARCHAR(10),
    region VARCHAR(120),
    city VARCHAR(120),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geo_provider VARCHAR(50),

    spam BOOLEAN NOT NULL DEFAULT FALSE,
    spam_reason VARCHAR(120),

    idempotency_key VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_tenant_id
    ON submissions(tenant_id);

CREATE INDEX idx_submissions_widget_id
    ON submissions(widget_id);

CREATE INDEX idx_submissions_created_at
    ON submissions(created_at);

CREATE INDEX idx_submissions_tenant_created_at
    ON submissions(tenant_id, created_at);

CREATE INDEX idx_submissions_widget_created_at
    ON submissions(widget_id, created_at);

CREATE UNIQUE INDEX idx_submissions_widget_idempotency
    ON submissions(widget_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- SESSIONS
-- ============================================================

CREATE TABLE sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expire
    ON sessions(expire);


-- ============================================================
-- BACKGROUND JOBS
-- ============================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,

    type VARCHAR(80) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,

    last_error TEXT,
    failure_alerted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT jobs_attempts_non_negative
        CHECK (attempts >= 0),

    CONSTRAINT jobs_max_attempts_positive
        CHECK (max_attempts > 0),

    CONSTRAINT jobs_status_valid
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed'
            )
        )
);

CREATE INDEX idx_jobs_pending
    ON jobs(status, available_at);

CREATE INDEX idx_jobs_submission_id
    ON jobs(submission_id);

CREATE INDEX idx_jobs_tenant_id
    ON jobs(tenant_id);