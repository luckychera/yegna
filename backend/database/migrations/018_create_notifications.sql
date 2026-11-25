-- Migration 018
-- Create persistent in-app notifications

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    community_id UUID,

    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    priority VARCHAR(16) NOT NULL DEFAULT 'normal',

    entity_type VARCHAR(64),
    entity_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT notifications_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT notifications_priority_check
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    CONSTRAINT notifications_metadata_object_check
        CHECK (
            jsonb_typeof(metadata) = 'object'
        )
);

CREATE INDEX notifications_user_created_idx
    ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
    ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX notifications_community_created_idx
    ON notifications (community_id, created_at DESC);

CREATE INDEX notifications_entity_idx
    ON notifications (entity_type, entity_id)
    WHERE entity_type IS NOT NULL
      AND entity_id IS NOT NULL;

CREATE INDEX notifications_expires_idx
    ON notifications (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
