BEGIN;

-- Read receipts are kept apart from notifications so read/unread state still
-- works for members who switched announcement notifications off.
CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id UUID NOT NULL,
    user_id UUID NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT announcement_reads_pkey
        PRIMARY KEY (announcement_id, user_id),

    CONSTRAINT announcement_reads_announcement_fk
        FOREIGN KEY (announcement_id)
        REFERENCES community_announcements(id)
        ON DELETE CASCADE,

    CONSTRAINT announcement_reads_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx
ON announcement_reads (user_id, read_at DESC);

COMMIT;
