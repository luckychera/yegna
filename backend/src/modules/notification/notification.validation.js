const {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
} = require('./notification.constants');

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function validateNotificationId(notificationId) {
  if (
    typeof notificationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)
  ) {
    throw createValidationError('notificationId must be a valid UUID');
  }

  return notificationId;
}

function validateNotificationType(type) {
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw createValidationError('notification type is required');
  }

  if (type.length > 64) {
    throw createValidationError('notification type must not exceed 64 characters');
  }

  return type.trim();
}

function validateNotificationPriority(priority) {
  const value = priority || NOTIFICATION_PRIORITY.NORMAL;

  if (!Object.values(NOTIFICATION_PRIORITY).includes(value)) {
    throw createValidationError('invalid notification priority');
  }

  return value;
}

function validateNotificationChannel(channel) {
  if (!Object.values(NOTIFICATION_CHANNEL).includes(channel)) {
    throw createValidationError('invalid notification channel');
  }

  return channel;
}

function validateNotificationContent({ title, message }) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw createValidationError('notification title is required');
  }

  if (title.trim().length > 255) {
    throw createValidationError('notification title must not exceed 255 characters');
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    throw createValidationError('notification message is required');
  }

  return {
    title: title.trim(),
    message: message.trim(),
  };
}

module.exports = {
  validateNotificationId,
  validateNotificationType,
  validateNotificationPriority,
  validateNotificationChannel,
  validateNotificationContent,
};
