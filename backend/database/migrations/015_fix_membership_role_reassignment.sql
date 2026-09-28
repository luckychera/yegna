BEGIN;

ALTER TABLE membership_roles
DROP CONSTRAINT IF EXISTS membership_roles_unique_assignment;

CREATE UNIQUE INDEX IF NOT EXISTS membership_roles_active_unique
ON membership_roles (membership_id, role_id)
WHERE revoked_at IS NULL;

COMMIT;
