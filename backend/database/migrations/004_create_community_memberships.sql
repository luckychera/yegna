-- Migration 004
-- Create community memberships

CREATE TABLE community_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,
    user_id UUID NOT NULL,

    membership_number VARCHAR(50),

    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    joined_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT community_memberships_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT community_memberships_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT community_memberships_status_check
        CHECK (
            status IN (
                'pending',
                'active',
                'suspended',
                'rejected',
                'left'
            )
        ),

    CONSTRAINT community_memberships_unique_user_community
        UNIQUE (community_id, user_id),

    CONSTRAINT community_memberships_membership_number_unique
        UNIQUE (community_id, membership_number)
);

CREATE INDEX community_memberships_user_id_idx
    ON community_memberships (user_id);

CREATE INDEX community_memberships_community_id_idx
    ON community_memberships (community_id);

CREATE INDEX community_memberships_status_idx
    ON community_memberships (status);

CREATE INDEX community_memberships_active_idx
    ON community_memberships (community_id)
    WHERE status = 'active';
