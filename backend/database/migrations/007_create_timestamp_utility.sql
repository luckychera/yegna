-- Migration 007
-- Create reusable updated_at timestamp utility

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER identities_set_updated_at
BEFORE UPDATE ON identities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER communities_set_updated_at
BEFORE UPDATE ON communities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER community_memberships_set_updated_at
BEFORE UPDATE ON community_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER community_roles_set_updated_at
BEFORE UPDATE ON community_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER membership_roles_set_updated_at
BEFORE UPDATE ON membership_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
