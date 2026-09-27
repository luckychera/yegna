-- Migration 013
-- Create centralized audit logs

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    community_id UUID,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100),
    entity_id UUID,

    ip_address INET,
    user_agent TEXT,

    old_values JSONB,
    new_values JSONB,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_logs_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL,

    CONSTRAINT audit_logs_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE SET NULL,

    CONSTRAINT audit_logs_old_values_object_check
        CHECK (
            old_values IS NULL
            OR jsonb_typeof(old_values) = 'object'
        ),

    CONSTRAINT audit_logs_new_values_object_check
        CHECK (
            new_values IS NULL
            OR jsonb_typeof(new_values) = 'object'
        ),

    CONSTRAINT audit_logs_metadata_object_check
        CHECK (
            jsonb_typeof(metadata) = 'object'
        )
);


CREATE INDEX audit_logs_user_id_idx
    ON audit_logs (user_id);

CREATE INDEX audit_logs_community_id_idx
    ON audit_logs (community_id);

CREATE INDEX audit_logs_action_idx
    ON audit_logs (action);

CREATE INDEX audit_logs_entity_idx
    ON audit_logs (entity_type, entity_id);

CREATE INDEX audit_logs_created_at_idx
    ON audit_logs (created_at);
