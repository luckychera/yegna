-- Migration 023
-- Community announcements (meetings, events, reminders, notices, updates),
-- published by members holding the announcements.manage permission.

CREATE TABLE community_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL
        REFERENCES communities (id)
        ON DELETE CASCADE,

    author_user_id UUID
        REFERENCES users (id)
        ON DELETE SET NULL,

    category VARCHAR(32) NOT NULL DEFAULT 'update',

    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,

    -- When the meeting or event takes place (only meaningful for those categories).
    event_at TIMESTAMPTZ,
    location VARCHAR(200),

    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,

    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,

    CONSTRAINT community_announcements_category_check
        CHECK (
            category IN (
                'update',
                'meeting',
                'event',
                'contribution_reminder',
                'notice'
            )
        ),

    CONSTRAINT community_announcements_title_check
        CHECK (length(btrim(title)) > 0),

    CONSTRAINT community_announcements_body_check
        CHECK (length(btrim(body)) > 0)
);

CREATE INDEX community_announcements_feed_idx
    ON community_announcements (community_id, is_pinned DESC, published_at DESC)
    WHERE archived_at IS NULL;

CREATE INDEX community_announcements_author_idx
    ON community_announcements (author_user_id);

CREATE TRIGGER community_announcements_set_updated_at
BEFORE UPDATE ON community_announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Existing community administrator roles receive the new permission.
UPDATE community_roles
SET permissions = permissions || '["announcements.manage"]'::JSONB
WHERE name = 'admin'
  AND is_system_role = TRUE
  AND NOT permissions ? 'announcements.manage';
