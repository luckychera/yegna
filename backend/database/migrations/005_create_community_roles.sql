-- Migration 005
-- Create community roles

CREATE TABLE community_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    permissions JSONB NOT NULL DEFAULT '[]'::JSONB,

    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT community_roles_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT community_roles_unique_name
        UNIQUE (community_id, name),

    CONSTRAINT community_roles_permissions_array_check
        CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE INDEX community_roles_community_id_idx
    ON community_roles (community_id);
