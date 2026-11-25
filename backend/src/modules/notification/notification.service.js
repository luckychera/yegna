const { pool } = require('../../config/database');

const { NOTIFICATION_PRIORITY, NOTIFICATION_DELIVERY_STATUS } = require('./notification.constants');

const {
  validateNotificationId,
  validateNotificationType,
  validateNotificationPriority,
  validateNotificationChannel,
  validateNotificationContent,
} = require('./notification.validation');

function createNotificationError(message, statusCode = 400, code = 'NOTIFICATION_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw createNotificationError(
      'notification metadata must be an object',
      400,
      'VALIDATION_ERROR',
    );
  }

  return metadata;
}

async function ensureUserExists(client, userId) {
  const result = await client.query(
    `
      SELECT id
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  if (result.rowCount === 0) {
    throw createNotificationError('User not found', 404, 'USER_NOT_FOUND');
  }
}

async function ensureCommunityExists(client, communityId) {
  if (!communityId) {
    return;
  }

  const result = await client.query(
    `
      SELECT id
      FROM communities
      WHERE id = $1
      LIMIT 1
    `,
    [communityId],
  );

  if (result.rowCount === 0) {
    throw createNotificationError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
  }
}

async function createNotification({
  userId,
  communityId = null,
  type,
  title,
  message,
  priority = NOTIFICATION_PRIORITY.NORMAL,
  entityType = null,
  entityId = null,
  metadata = {},
  expiresAt = null,
  client: providedClient = null,
}) {
  if (!userId) {
    throw createNotificationError('userId is required', 400, 'VALIDATION_ERROR');
  }

  validateNotificationType(type);

  const normalizedPriority = validateNotificationPriority(priority);

  const content = validateNotificationContent({
    title,
    message,
  });

  const normalizedMetadata = normalizeMetadata(metadata);

  const client = providedClient || (await pool.connect());
  const ownsClient = !providedClient;

  try {
    if (ownsClient) {
      await client.query('BEGIN');
    }

    await ensureUserExists(client, userId);
    await ensureCommunityExists(client, communityId);

    const result = await client.query(
      `
        INSERT INTO notifications (
          user_id,
          community_id,
          type,
          title,
          message,
          priority,
          entity_type,
          entity_id,
          metadata,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10
        )
        RETURNING *
      `,
      [
        userId,
        communityId,
        type,
        content.title,
        content.message,
        normalizedPriority,
        entityType,
        entityId,
        JSON.stringify(normalizedMetadata),
        expiresAt,
      ],
    );

    if (ownsClient) {
      await client.query('COMMIT');
    }

    return result.rows[0];
  } catch (error) {
    if (ownsClient) {
      await client.query('ROLLBACK');
    }

    throw error;
  } finally {
    if (ownsClient) {
      client.release();
    }
  }
}

async function createBulkNotifications({ notifications, client: providedClient = null }) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    throw createNotificationError(
      'notifications must be a non-empty array',
      400,
      'VALIDATION_ERROR',
    );
  }

  const client = providedClient || (await pool.connect());
  const ownsClient = !providedClient;

  try {
    if (ownsClient) {
      await client.query('BEGIN');
    }

    const createdNotifications = [];

    for (const notification of notifications) {
      const created = await createNotification({
        ...notification,
        client,
      });

      createdNotifications.push(created);
    }

    if (ownsClient) {
      await client.query('COMMIT');
    }

    return createdNotifications;
  } catch (error) {
    if (ownsClient) {
      await client.query('ROLLBACK');
    }

    throw error;
  } finally {
    if (ownsClient) {
      client.release();
    }
  }
}

async function getNotificationById({ notificationId, userId = null }) {
  validateNotificationId(notificationId);

  const values = [notificationId];

  let userFilter = '';

  if (userId) {
    values.push(userId);
    userFilter = 'AND n.user_id = $2';
  }

  const result = await pool.query(
    `
      SELECT
        n.*,
        nd.channel,
        nd.status AS delivery_status,
        nd.provider,
        nd.provider_message_id,
        nd.attempt_count,
        nd.queued_at,
        nd.sent_at,
        nd.delivered_at,
        nd.failed_at,
        nd.failure_reason
      FROM notifications n
      LEFT JOIN notification_deliveries nd
        ON nd.notification_id = n.id
      WHERE n.id = $1
        ${userFilter}
      ORDER BY nd.created_at ASC
    `,
    values,
  );

  if (result.rowCount === 0) {
    throw createNotificationError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }

  const notification = {
    id: result.rows[0].id,
    user_id: result.rows[0].user_id,
    community_id: result.rows[0].community_id,
    type: result.rows[0].type,
    title: result.rows[0].title,
    message: result.rows[0].message,
    priority: result.rows[0].priority,
    entity_type: result.rows[0].entity_type,
    entity_id: result.rows[0].entity_id,
    metadata: result.rows[0].metadata,
    read_at: result.rows[0].read_at,
    expires_at: result.rows[0].expires_at,
    created_at: result.rows[0].created_at,
    updated_at: result.rows[0].updated_at,
    deliveries: [],
  };

  for (const row of result.rows) {
    if (row.channel) {
      notification.deliveries.push({
        channel: row.channel,
        status: row.delivery_status,
        provider: row.provider,
        provider_message_id: row.provider_message_id,
        attempt_count: row.attempt_count,
        queued_at: row.queued_at,
        sent_at: row.sent_at,
        delivered_at: row.delivered_at,
        failed_at: row.failed_at,
        failure_reason: row.failure_reason,
      });
    }
  }

  return notification;
}

async function listUserNotifications({ userId, unreadOnly = false, limit = 50, offset = 0 }) {
  if (!userId) {
    throw createNotificationError('userId is required', 400, 'VALIDATION_ERROR');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createNotificationError('limit must be between 1 and 100', 400, 'VALIDATION_ERROR');
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw createNotificationError('offset must be a non-negative integer', 400, 'VALIDATION_ERROR');
  }

  const unreadFilter = unreadOnly ? 'AND n.read_at IS NULL' : '';

  const result = await pool.query(
    `
      SELECT
        n.*
      FROM notifications n
      WHERE n.user_id = $1
        ${unreadFilter}
        AND (
          n.expires_at IS NULL
          OR n.expires_at > NOW()
        )
      ORDER BY n.created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows;
}

async function getUnreadNotificationCount(userId) {
  if (!userId) {
    throw createNotificationError('userId is required', 400, 'VALIDATION_ERROR');
  }

  const result = await pool.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM notifications
      WHERE user_id = $1
        AND read_at IS NULL
        AND (
          expires_at IS NULL
          OR expires_at > NOW()
        )
    `,
    [userId],
  );

  return result.rows[0].count;
}

async function markNotificationAsRead({ notificationId, userId }) {
  validateNotificationId(notificationId);

  if (!userId) {
    throw createNotificationError('userId is required', 400, 'VALIDATION_ERROR');
  }

  const result = await pool.query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING *
    `,
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    throw createNotificationError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }

  return result.rows[0];
}

async function markAllNotificationsAsRead(userId) {
  if (!userId) {
    throw createNotificationError('userId is required', 400, 'VALIDATION_ERROR');
  }

  const result = await pool.query(
    `
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1
        AND read_at IS NULL
      RETURNING id
    `,
    [userId],
  );

  return {
    updatedCount: result.rowCount,
  };
}

async function createNotificationDelivery({
  notificationId,
  channel,
  provider = null,
  metadata = {},
}) {
  validateNotificationId(notificationId);
  validateNotificationChannel(channel);

  const normalizedMetadata = normalizeMetadata(metadata);

  const notificationResult = await pool.query(
    `
      SELECT id
      FROM notifications
      WHERE id = $1
      LIMIT 1
    `,
    [notificationId],
  );

  if (notificationResult.rowCount === 0) {
    throw createNotificationError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }

  const result = await pool.query(
    `
      INSERT INTO notification_deliveries (
        notification_id,
        channel,
        provider,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::jsonb
      )
      ON CONFLICT (notification_id, channel)
      DO UPDATE SET
        provider = EXCLUDED.provider,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [notificationId, channel, provider, JSON.stringify(normalizedMetadata)],
  );

  return result.rows[0];
}

async function updateNotificationDeliveryStatus({
  deliveryId,
  status,
  providerMessageId = null,
  failureReason = null,
}) {
  if (!deliveryId) {
    throw createNotificationError('deliveryId is required', 400, 'VALIDATION_ERROR');
  }

  if (!Object.values(NOTIFICATION_DELIVERY_STATUS).includes(status)) {
    throw createNotificationError('invalid notification delivery status', 400, 'VALIDATION_ERROR');
  }

  const result = await pool.query(
    `
      UPDATE notification_deliveries
      SET
        status = $2::VARCHAR(32),
        provider_message_id = COALESCE($3, provider_message_id),
        failure_reason = $4,
        attempt_count = attempt_count + 1,
        queued_at = CASE
          WHEN $2::VARCHAR(32) = 'queued' AND queued_at IS NULL
          THEN NOW()
          ELSE queued_at
        END,
        sent_at = CASE
          WHEN $2::VARCHAR(32) = 'sent' AND sent_at IS NULL
          THEN NOW()
          ELSE sent_at
        END,
        delivered_at = CASE
          WHEN $2::VARCHAR(32) = 'delivered' AND delivered_at IS NULL
          THEN NOW()
          ELSE delivered_at
        END,
        failed_at = CASE
          WHEN $2::VARCHAR(32) = 'failed'
          THEN NOW()
          ELSE failed_at
        END
      WHERE id = $1
      RETURNING *
    `,
    [deliveryId, status, providerMessageId, failureReason],
  );
  if (result.rowCount === 0) {
    throw createNotificationError('Notification delivery not found', 404, 'DELIVERY_NOT_FOUND');
  }

  return result.rows[0];
}

module.exports = {
  ensureUserExists,
  ensureCommunityExists,
  createNotification,
  createBulkNotifications,
  getNotificationById,
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotificationDelivery,
  updateNotificationDeliveryStatus,
};
