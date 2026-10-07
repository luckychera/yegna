BEGIN;

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    replaced_by_session_id UUID
        REFERENCES auth_sessions(id) ON DELETE SET NULL,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auth_sessions_expiry_after_creation
        CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_id_idx
    ON auth_sessions(user_id);

CREATE INDEX auth_sessions_active_user_idx
    ON auth_sessions(user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX auth_sessions_expiry_idx
    ON auth_sessions(expires_at);

COMMIT;
