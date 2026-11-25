CREATE TABLE community_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL
        REFERENCES communities(id)
        ON DELETE CASCADE,

    inviter_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    invited_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(128) NOT NULL UNIQUE,

    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    expires_at TIMESTAMPTZ NOT NULL,

    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT community_invitations_status_check
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'revoked',
                'expired'
            )
        )
);

CREATE INDEX idx_community_invitations_community_id
    ON community_invitations(community_id);

CREATE INDEX idx_community_invitations_invited_user_id
    ON community_invitations(invited_user_id);

CREATE INDEX idx_community_invitations_inviter_user_id
    ON community_invitations(inviter_user_id);

CREATE INDEX idx_community_invitations_status
    ON community_invitations(status);

CREATE INDEX idx_community_invitations_expires_at
    ON community_invitations(expires_at);

CREATE UNIQUE INDEX idx_one_pending_invitation_per_user
    ON community_invitations(community_id, invited_user_id)
    WHERE status = 'pending';
