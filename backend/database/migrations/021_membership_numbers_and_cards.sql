-- Migration 021
-- Every active membership gets a community-scoped membership number and a private
-- card verification code. Both are random and never derived from identity data
-- (the Fayda FIN must not be used as a membership number).

ALTER TABLE community_memberships
ADD COLUMN card_verification_code VARCHAR(32);

CREATE UNIQUE INDEX community_memberships_card_verification_code_unique
    ON community_memberships (card_verification_code)
    WHERE card_verification_code IS NOT NULL;

-- Unambiguous alphabet (no 0/O, 1/I/L) so numbers can be read aloud and typed.
CREATE OR REPLACE FUNCTION yegna_random_code(code_length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    random_bytes BYTEA := gen_random_bytes(code_length);
    result TEXT := '';
BEGIN
    FOR idx IN 0..code_length - 1 LOOP
        result := result || substr(alphabet, (get_byte(random_bytes, idx) % length(alphabet)) + 1, 1);
    END LOOP;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION assign_membership_identifiers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    candidate TEXT;
BEGIN
    IF NEW.status = 'active' THEN
        IF NEW.membership_number IS NULL THEN
            LOOP
                candidate := 'YG-' || yegna_random_code(4) || '-' || yegna_random_code(4);

                EXIT WHEN NOT EXISTS (
                    SELECT 1
                    FROM community_memberships
                    WHERE community_id = NEW.community_id
                      AND membership_number = candidate
                );
            END LOOP;

            NEW.membership_number := candidate;
        END IF;

        IF NEW.card_verification_code IS NULL THEN
            NEW.card_verification_code := yegna_random_code(24);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER community_memberships_assign_identifiers
BEFORE INSERT OR UPDATE OF status, membership_number, card_verification_code
ON community_memberships
FOR EACH ROW
EXECUTE FUNCTION assign_membership_identifiers();

-- Backfill memberships that are already active.
UPDATE community_memberships
SET status = status
WHERE status = 'active'
  AND (membership_number IS NULL OR card_verification_code IS NULL);
