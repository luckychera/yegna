const { pool } = require('../../config/database');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { NOTIFICATION_TYPE } = require('../notification/notification.constants');

const NOTIFICATION_ENTITY_TYPE = 'announcement';
const PREVIEW_LENGTH = 280;

function notFound() {
  const error = new Error('Announcement not found');
  error.statusCode = 404;
  error.code = 'ANNOUNCEMENT_NOT_FOUND';
  return error;
}

function authorName(row) {
  if (!row.author_user_id) return 'Former member';

  const displayName = row.author_display_name && row.author_display_name.trim();

  if (displayName) return displayName;

  return [row.author_first_name, row.author_last_name].filter((part) => part && part.trim()).join(' ') || 'Community admin';
}

function toAnnouncement(row) {
  return {
    id: row.id,
    communityId: row.community_id,
    category: row.category,
    title: row.title,
    body: row.body,
    eventAt: row.event_at,
    location: row.location,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    isRead: Boolean(row.is_read),
    author: {
      id: row.author_user_id,
      name: authorName(row),
      avatarUrl: row.author_avatar_url || null,
    },
    ...(row.community_name
      ? {
          community: {
            id: row.community_id,
            name: row.community_name,
            logoUrl: row.community_logo_url,
          },
        }
      : {}),
  };
}

// Announcements published before the member joined count as read, so a new
// member is not greeted by the community's whole history as unread.
const FEED_SELECT = `
  SELECT
    a.*,
    up.first_name AS author_first_name,
    up.last_name AS author_last_name,
    up.display_name AS author_display_name,
    up.avatar_url AS author_avatar_url,
    (
      COALESCE(a.author_user_id = cm.user_id, FALSE)
      OR ar.user_id IS NOT NULL
      OR a.published_at < COALESCE(cm.approved_at, cm.joined_at, cm.created_at)
    ) AS is_read
  FROM community_announcements a
  JOIN community_memberships cm
    ON cm.community_id = a.community_id
   AND cm.user_id = $1
   AND cm.status = 'active'
  LEFT JOIN user_profiles up
    ON up.user_id = a.author_user_id
  LEFT JOIN announcement_reads ar
    ON ar.announcement_id = a.id
   AND ar.user_id = cm.user_id
`;

async function listCommunityAnnouncements({ communityId, userId, limit, offset }) {
  const result = await pool.query(
    `
      ${FEED_SELECT}
      WHERE a.community_id = $2
        AND a.archived_at IS NULL
      ORDER BY a.is_pinned DESC, a.published_at DESC
      LIMIT $3 OFFSET $4;
    `,
    [userId, communityId, limit, offset],
  );

  const unread = await pool.query(
    `
      SELECT COUNT(*)::INT AS count
      FROM (${FEED_SELECT} WHERE a.community_id = $2 AND a.archived_at IS NULL) feed
      WHERE NOT feed.is_read;
    `,
    [userId, communityId],
  );

  return {
    announcements: result.rows.map(toAnnouncement),
    unreadCount: unread.rows[0].count,
  };
}

/** Latest announcements across every community where the caller is an active member. */
async function listMyAnnouncements({ userId, limit }) {
  const result = await pool.query(
    `
      SELECT feed.*, c.name AS community_name, c.logo_url AS community_logo_url
      FROM (${FEED_SELECT} WHERE a.archived_at IS NULL) feed
      JOIN communities c
        ON c.id = feed.community_id
       AND c.archived_at IS NULL
      ORDER BY feed.published_at DESC
      LIMIT $2;
    `,
    [userId, limit],
  );

  return result.rows.map(toAnnouncement);
}

async function getAnnouncement({ communityId, announcementId, userId }) {
  const result = await pool.query(
    `
      ${FEED_SELECT}
      WHERE a.community_id = $2
        AND a.id = $3
        AND a.archived_at IS NULL;
    `,
    [userId, communityId, announcementId],
  );

  if (!result.rows[0]) throw notFound();

  return toAnnouncement(result.rows[0]);
}

function previewOf(body) {
  const flat = body.replace(/\s+/g, ' ').trim();

  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
}

async function createAnnouncement({ communityId, userId, input, ipAddress, userAgent }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `
        INSERT INTO community_announcements (
          community_id, author_user_id, category, title, body, event_at, location, is_pinned
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `,
      [
        communityId,
        userId,
        input.category,
        input.title,
        input.body,
        input.eventAt,
        input.location,
        input.isPinned,
      ],
    );

    const announcement = inserted.rows[0];

    const community = await client.query('SELECT name FROM communities WHERE id = $1', [communityId]);
    const communityName = community.rows[0] ? community.rows[0].name : 'Your community';

    // One set-based insert for every other active member who has not muted
    // announcement notifications.
    const notified = await client.query(
      `
        INSERT INTO notifications (
          user_id, community_id, type, title, message, priority, entity_type, entity_id, metadata
        )
        SELECT
          cm.user_id, $1, $2, $3, $4, $5, $6, $7, $8::JSONB
        FROM community_memberships cm
        LEFT JOIN notification_preferences np
          ON np.user_id = cm.user_id
        WHERE cm.community_id = $1
          AND cm.status = 'active'
          AND cm.user_id <> $9
          AND COALESCE(np.in_app ->> 'announcements', 'true') <> 'false';
      `,
      [
        communityId,
        NOTIFICATION_TYPE.COMMUNITY_ANNOUNCEMENT,
        `${communityName}: ${input.title}`.slice(0, 255),
        previewOf(input.body),
        input.isPinned || input.category === 'notice' ? 'high' : 'normal',
        NOTIFICATION_ENTITY_TYPE,
        announcement.id,
        JSON.stringify({ category: input.category }),
        userId,
      ],
    );

    await createAuditLog({
      userId,
      communityId,
      action: AUDIT_ACTIONS.ANNOUNCEMENT_PUBLISHED,
      entityType: AUDIT_ENTITY_TYPES.ANNOUNCEMENT,
      entityId: announcement.id,
      ipAddress,
      userAgent,
      newValues: { title: input.title, category: input.category, isPinned: input.isPinned },
      metadata: { notifiedMembers: notified.rowCount },
      client,
    });

    await client.query('COMMIT');

    return {
      announcement: await getAnnouncement({ communityId, announcementId: announcement.id, userId }),
      notifiedMembers: notified.rowCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const COLUMN_FOR_FIELD = {
  title: 'title',
  body: 'body',
  category: 'category',
  eventAt: 'event_at',
  location: 'location',
  isPinned: 'is_pinned',
};

async function updateAnnouncement({ communityId, announcementId, userId, input, ipAddress, userAgent }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT *
        FROM community_announcements
        WHERE id = $1 AND community_id = $2 AND archived_at IS NULL
        FOR UPDATE;
      `,
      [announcementId, communityId],
    );

    if (!existing.rows[0]) throw notFound();

    const fields = Object.keys(input);
    const assignments = fields.map((field, index) => `${COLUMN_FOR_FIELD[field]} = $${index + 3}`);

    await client.query(
      `UPDATE community_announcements SET ${assignments.join(', ')} WHERE id = $1 AND community_id = $2;`,
      [announcementId, communityId, ...fields.map((field) => input[field])],
    );

    const before = existing.rows[0];

    await createAuditLog({
      userId,
      communityId,
      action: AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ANNOUNCEMENT,
      entityId: announcementId,
      ipAddress,
      userAgent,
      oldValues: Object.fromEntries(fields.map((field) => [field, before[COLUMN_FOR_FIELD[field]]])),
      newValues: input,
      client,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getAnnouncement({ communityId, announcementId, userId });
}

async function archiveAnnouncement({ communityId, announcementId, userId, ipAddress, userAgent }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const archived = await client.query(
      `
        UPDATE community_announcements
        SET archived_at = NOW()
        WHERE id = $1 AND community_id = $2 AND archived_at IS NULL
        RETURNING id, title;
      `,
      [announcementId, communityId],
    );

    if (!archived.rows[0]) throw notFound();

    // Members should not be sent to an announcement that no longer exists.
    await client.query(
      `
        UPDATE notifications
        SET expires_at = NOW()
        WHERE entity_type = $1
          AND entity_id = $2
          AND (expires_at IS NULL OR expires_at > NOW());
      `,
      [NOTIFICATION_ENTITY_TYPE, announcementId],
    );

    await createAuditLog({
      userId,
      communityId,
      action: AUDIT_ACTIONS.ANNOUNCEMENT_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.ANNOUNCEMENT,
      entityId: announcementId,
      ipAddress,
      userAgent,
      oldValues: { title: archived.rows[0].title },
      client,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { archived: true };
}

async function markAnnouncementRead({ communityId, announcementId, userId }) {
  const exists = await pool.query(
    'SELECT 1 FROM community_announcements WHERE id = $1 AND community_id = $2 AND archived_at IS NULL',
    [announcementId, communityId],
  );

  if (exists.rowCount === 0) throw notFound();

  await pool.query(
    `
      INSERT INTO announcement_reads (announcement_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (announcement_id, user_id) DO NOTHING;
    `,
    [announcementId, userId],
  );

  await pool.query(
    `
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1
        AND entity_type = $2
        AND entity_id = $3
        AND read_at IS NULL;
    `,
    [userId, NOTIFICATION_ENTITY_TYPE, announcementId],
  );

  return { read: true };
}

module.exports = {
  listCommunityAnnouncements,
  listMyAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
  markAnnouncementRead,
};
