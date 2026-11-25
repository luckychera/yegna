-- Migration 003
-- Create the core communities table

CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    description TEXT,

    community_type VARCHAR(50) NOT NULL DEFAULT 'other',

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    created_by UUID NOT NULL,

    logo_url TEXT,

    settings JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,

    CONSTRAINT communities_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON DELETE RESTRICT,

    CONSTRAINT communities_type_check
        CHECK (
            community_type IN (
                'equb',
                'edir',
                'mahiber',
                'association',
                'neighborhood',
                'youth_group',
                'religious',
                'social',
                'professional',
                'other'
            )
        ),

    CONSTRAINT communities_status_check
        CHECK (
            status IN (
                'active',
                'suspended',
                'archived'
            )
        )
);

CREATE INDEX communities_created_by_idx
    ON communities (created_by);

CREATE INDEX communities_type_idx
    ON communities (community_type);

CREATE INDEX communities_status_idx
    ON communities (status);

CREATE INDEX communities_active_idx
    ON communities (id)
    WHERE archived_at IS NULL;
