const { createNotification } = require('./notification.service');
const { isInAppNotificationEnabled } = require('./notification.preferences');

async function notifySafely(notification) {
  try {
    // Members can switch off categories of business notifications.
    if (!(await isInAppNotificationEnabled(notification.userId, notification.type))) {
      return null;
    }

    return await createNotification(notification);
  } catch (error) {
    // Notification failures must not reverse a committed business operation.
    console.error('[notification-event] Failed to create notification:', {
      type: notification.type,
      entityType: notification.entityType,
      entityId: notification.entityId,
      code: error.code || 'NOTIFICATION_ERROR',
      message: error.message,
    });

    return null;
  }
}

module.exports = { notifySafely };
