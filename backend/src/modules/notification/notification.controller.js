const notificationService = require('./notification.service');

function parseBoolean(value, fieldName) {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const error = new Error(`${fieldName} must be true or false`);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  throw error;
}

function parseInteger(value, defaultValue, fieldName, min, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return defaultValue;

  if (!/^\d+$/.test(String(value))) {
    const error = new Error(`${fieldName} must be a valid integer`);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < min || number > max) {
    const error = new Error(
      `${fieldName} must be between ${min} and ${max}`,
    );
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return number;
}

async function list(req, res, next) {
  try {
    const unreadOnly = parseBoolean(req.query.unreadOnly, 'unreadOnly');
    const limit = parseInteger(req.query.limit, 50, 'limit', 1, 100);
    const offset = parseInteger(
      req.query.offset,
      0,
      'offset',
      0,
    );

    const notifications = await notificationService.listUserNotifications({
      userId: req.user.id,
      unreadOnly,
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: { limit, offset, count: notifications.length },
    });
  } catch (error) {
    return next(error);
  }
}

async function unreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadNotificationCount(
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const notification = await notificationService.getNotificationById({
      notificationId: req.params.notificationId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await notificationService.markNotificationAsRead({
      notificationId: req.params.notificationId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const result = await notificationService.markAllNotificationsAsRead(
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  unreadCount,
  getById,
  markRead,
  markAllRead,
};
