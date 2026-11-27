-- Store the role an invitation will grant once it is accepted and the
-- membership is active. A pending invitation does not assign the role.
ALTER TABLE community_invitations
    ADD COLUMN role_id UUID;

ALTER TABLE community_invitations
    ADD CONSTRAINT community_invitations_role_fk
        FOREIGN KEY (role_id)
        REFERENCES community_roles (id)
        ON DELETE SET NULL;

CREATE INDEX community_invitations_role_id_idx
    ON community_invitations (role_id);

-- Every existing community receives the predefined roles it does not already
-- have. An existing admin role keeps the permission list from earlier migrations.
INSERT INTO community_roles (community_id, name, description, permissions, is_system_role)
SELECT c.id, role.name, role.description, role.permissions, TRUE
FROM communities c
CROSS JOIN (
    VALUES
        (
            'member',
            'Takes part in the community and can invite people, who join as members.',
            '["community.view","members.invite"]'::JSONB
        ),
        (
            'committee_member',
            'Sees the member list and can publish announcements.',
            '["community.view","members.view","members.invite","announcements.manage","contributions.view"]'::JSONB
        ),
        (
            'secretary',
            'Keeps the member list and community announcements.',
            '["community.view","members.view","members.invite","members.update","announcements.manage","contributions.view"]'::JSONB
        ),
        (
            'treasurer',
            'Records contributions and payments. Cannot change roles.',
            '["community.view","contributions.view","contributions.create","contributions.update","payments.view","payments.create","finance.view","reports.view"]'::JSONB
        )
) AS role(name, description, permissions)
WHERE NOT EXISTS (
    SELECT 1
    FROM community_roles existing
    WHERE existing.community_id = c.id
      AND existing.name = role.name
);

-- Active memberships that were created before roles were assigned become members.
-- Memberships that already have a role, including administrators, are left alone.
INSERT INTO membership_roles (membership_id, role_id, assigned_by)
SELECT cm.id, member_role.id, communities.created_by
FROM community_memberships cm
JOIN communities ON communities.id = cm.community_id
JOIN community_roles member_role
    ON member_role.community_id = cm.community_id
   AND member_role.name = 'member'
WHERE cm.status = 'active'
  AND NOT EXISTS (
      SELECT 1
      FROM membership_roles existing
      WHERE existing.membership_id = cm.id
        AND existing.revoked_at IS NULL
  );
