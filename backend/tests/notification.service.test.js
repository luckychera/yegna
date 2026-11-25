const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');

const {
  createNotification,
  createBulkNotifications,
  getNotificationById,
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotificationDelivery,
  updateNotificationDeliveryStatus,
} = require('../src/modules/notification/notification.service');

const {
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_DELIVERY_STATUS,
} = require('../src/modules/notification/notification.constants');

const TEST_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';

async function createTestUser(client, prefix = 'notification-test') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const result = await client.query(
    `
      INSERT INTO users (
        email,
        password_hash,
        status
      )
      VALUES (
        $1,
        'test-hash',
        'active'
      )
      RETURNING *
    `,
    [email],
  );

  return result.rows[0];
}

async function cleanupUser(userId) {
  await pool.query(
    `
      DELETE FROM users
      WHERE id = $1
    `,
    [userId],
  );
}

test.after(async () => {
  await pool.end();
});

test('creates a notification for a user', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    const notification = await createNotification({
      userId: user.id,
      communityId: TEST_COMMUNITY_ID,
      type: NOTIFICATION_TYPE.INVITATION_RECEIVED,
      title: 'Community Invitation',
      message: 'You have been invited to join a community.',
      priority: 'high',
      entityType: 'invitation',
      entityId: user.id,
      metadata: {
        invitationCode: 'TEST-INVITE',
      },
    });

    assert.equal(notification.user_id, user.id);
    assert.equal(notification.community_id, TEST_COMMUNITY_ID);
    assert.equal(notification.type, NOTIFICATION_TYPE.INVITATION_RECEIVED);
    assert.equal(notification.title, 'Community Invitation');
    assert.equal(notification.priority, 'high');
    assert.equal(notification.metadata.invitationCode, 'TEST-INVITE');
    assert.equal(notification.read_at, null);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('rejects notification for an unknown user', async () => {
  await assert.rejects(
    () => createNotification({
      userId: '00000000-0000-0000-0000-000000000000',
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Test',
      message: 'Test notification',
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'USER_NOT_FOUND');
      return true;
    },
  );
});

test('rejects invalid notification metadata', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    await assert.rejects(
      () => createNotification({
        userId: user.id,
        type: NOTIFICATION_TYPE.SYSTEM,
        title: 'Test',
        message: 'Test notification',
        metadata: ['invalid'],
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, 'VALIDATION_ERROR');
        return true;
      },
    );
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('creates and retrieves a notification with deliveries', async () => {
  const client = await pool.connect();
  let user;
  let notification;

  try {
    user = await createTestUser(client);

    notification = await createNotification({
      userId: user.id,
      communityId: TEST_COMMUNITY_ID,
      type: NOTIFICATION_TYPE.PAYMENT_SUCCESSFUL,
      title: 'Payment Successful',
      message: 'Your payment was successful.',
      metadata: {
        amount: 500,
        currency: 'ETB',
      },
    });

    const delivery = await createNotificationDelivery({
      notificationId: notification.id,
      channel: NOTIFICATION_CHANNEL.IN_APP,
    });

    assert.equal(delivery.notification_id, notification.id);
    assert.equal(delivery.channel, NOTIFICATION_CHANNEL.IN_APP);
    assert.equal(delivery.status, NOTIFICATION_DELIVERY_STATUS.PENDING);

    const result = await getNotificationById({
      notificationId: notification.id,
      userId: user.id,
    });

    assert.equal(result.id, notification.id);
    assert.equal(result.user_id, user.id);
    assert.equal(result.deliveries.length, 1);
    assert.equal(
      result.deliveries[0].channel,
      NOTIFICATION_CHANNEL.IN_APP,
    );
    assert.equal(
      result.deliveries[0].status,
      NOTIFICATION_DELIVERY_STATUS.PENDING,
    );
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('lists unread notifications and counts them', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Unread One',
      message: 'First unread notification',
    });

    await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Unread Two',
      message: 'Second unread notification',
    });

    const notifications = await listUserNotifications({
      userId: user.id,
      unreadOnly: true,
    });

    assert.equal(notifications.length, 2);

    const count = await getUnreadNotificationCount(user.id);

    assert.equal(count, 2);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('marks one notification as read', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    const notification = await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Read Me',
      message: 'This notification should be marked as read.',
    });

    const updated = await markNotificationAsRead({
      notificationId: notification.id,
      userId: user.id,
    });

    assert.equal(updated.id, notification.id);
    assert.ok(updated.read_at);

    const unreadCount = await getUnreadNotificationCount(user.id);

    assert.equal(unreadCount, 0);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('marks all notifications as read', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'First',
      message: 'First notification',
    });

    await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Second',
      message: 'Second notification',
    });

    const result = await markAllNotificationsAsRead(user.id);

    assert.equal(result.updatedCount, 2);

    const unreadCount = await getUnreadNotificationCount(user.id);

    assert.equal(unreadCount, 0);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('creates bulk notifications atomically', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    const notifications = await createBulkNotifications({
      notifications: [
        {
          userId: user.id,
          type: NOTIFICATION_TYPE.SYSTEM,
          title: 'Bulk One',
          message: 'First bulk notification',
        },
        {
          userId: user.id,
          type: NOTIFICATION_TYPE.SYSTEM,
          title: 'Bulk Two',
          message: 'Second bulk notification',
        },
      ],
    });

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0].user_id, user.id);
    assert.equal(notifications[1].user_id, user.id);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('updates notification delivery status', async () => {
  const client = await pool.connect();
  let user;

  try {
    user = await createTestUser(client);

    const notification = await createNotification({
      userId: user.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Delivery Test',
      message: 'Testing delivery status.',
    });

    const delivery = await createNotificationDelivery({
      notificationId: notification.id,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      provider: 'test-provider',
    });

    const updated = await updateNotificationDeliveryStatus({
      deliveryId: delivery.id,
      status: NOTIFICATION_DELIVERY_STATUS.SENT,
      providerMessageId: 'test-message-001',
    });

    assert.equal(updated.status, NOTIFICATION_DELIVERY_STATUS.SENT);
    assert.equal(updated.provider_message_id, 'test-message-001');
    assert.equal(updated.attempt_count, 1);
    assert.ok(updated.sent_at);
  } finally {
    client.release();

    if (user) {
      await cleanupUser(user.id);
    }
  }
});

test('rejects reading another user notification', async () => {
  const client = await pool.connect();
  let owner;
  let otherUser;

  try {
    owner = await createTestUser(client, 'notification-owner');
    otherUser = await createTestUser(client, 'notification-other');

    const notification = await createNotification({
      userId: owner.id,
      type: NOTIFICATION_TYPE.SYSTEM,
      title: 'Private',
      message: 'Private notification',
    });

    await assert.rejects(
      () => getNotificationById({
        notificationId: notification.id,
        userId: otherUser.id,
      }),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, 'NOTIFICATION_NOT_FOUND');
        return true;
      },
    );
  } finally {
    client.release();

    if (owner) {
      await cleanupUser(owner.id);
    }

    if (otherUser) {
      await cleanupUser(otherUser.id);
    }
  }
});
