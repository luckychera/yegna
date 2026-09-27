-- Migration 006
-- Assign community roles to community memberships

CREATE TABLE membership_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    membership_id UUID NOT NULL,
    role_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    assigned_by UUID,

    CONSTRAINT membership_roles_membership_fk
        FOREIGN KEY (membership_id)
        REFERENCES community_memberships (id)
        ON DELETE CASCADE,

    CONSTRAINT membership_roles_role_fk
        FOREIGN KEY (role_id)
        REFERENCES community_roles (id)
        ON DELETE CASCADE,

    CONSTRAINT membership_roles_assigned_by_fk
        FOREIGN KEY (assigned_by)
        REFERENCES users (id)
        ON DELETE SET NULL,

    CONSTRAINT membership_roles_unique_assignment
        UNIQUE (membership_id, role_id)
);

CREATE INDEX membership_roles_membership_id_idx
    ON membership_roles (membership_id);

CREATE INDEX membership_roles_role_id_idx
    ON membership_roles (role_id);

CREATE INDEX membership_roles_active_idx
    ON membership_roles (membership_id)
    WHERE revoked_at IS NULL;
