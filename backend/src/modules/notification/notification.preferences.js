const { pool } = require('../../config/database');
const { NOTIFICATION_TYPE } = require('./notification.constants');

// Preference categories a member can switch off. Each maps to the notification
// types it covers; types outside every category (for example `system`) are
// always delivered.
const NOTIFICATION_CATEGORIES = Object.freeze({
  announcements: [NOTIFICATION_TYPE.COMMUNITY_ANNOUNCEMENT],
  contributions: [
    NOTIFICATION_TYPE.CONTRIBUTION_CREATED,
    NOTIFICATION_TYPE.CONTRIBUTION_DUE,
    NOTIFICATION_TYPE.CONTRIBUTION_OVERDUE,
  ],
  payments: [
    NOTIFICATION_TYPE.PAYMENT_SUCCESSFUL,
    NOTIFICATION_TYPE.PAYMENT_FAILED,
    NOTIFICATION_TYPE.PAYMENT_REFUNDED,
  ],
  memberships: [
    NOTIFICATION_TYPE.MEMBERSHIP_APPROVED,
    NOTIFICATION_TYPE.MEMBERSHIP_SUSPENDED,
    NOTIFICATION_TYPE.MEMBERSHIP_REMOVED,
  ],
  invitations: [
    NOTIFICATION_TYPE.INVITATION_RECEIVED,
    NOTIFICATION_TYPE.INVITATION_ACCEPTED,
    NOTIFICATION_TYPE.INVITATION_REJECTED,
  ],
});

const CATEGORY_NAMES = Object.keys(NOTIFICATION_CATEGORIES);

function categoryForType(type) {
  return CATEGORY_NAMES.find((category) => NOTIFICATION_CATEGORIES[category].includes(type)) || null;
}

function createPreferenceError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function withDefaults(stored = {}) {
  return Object.fromEntries(CATEGORY_NAMES.map((category) => [category, stored[category] !== false]));
}

async function getNotificationPreferences(userId, client = pool) {
  const result = await client.query(
    'SELECT in_app, updated_at FROM notification_preferences WHERE user_id = $1',
    [userId],
  );

  const row = result.rows[0];

  return {
    inApp: withDefaults(row ? row.in_app : {}),
    updatedAt: row ? row.updated_at : null,
  };
}

function validatePreferencesInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createPreferenceError('A preferences object is required', 'INVALID_PREFERENCES_INPUT');
  }

  const unknownKeys = Object.keys(input).filter((key) => key !== 'inApp');

  if (unknownKeys.length > 0) {
    throw createPreferenceError(`Unsupported preference channel: ${unknownKeys[0]}`, 'UNSUPPORTED_CHANNEL');
  }

  const inApp = input.inApp;

  if (!inApp || typeof inApp !== 'object' || Array.isArray(inApp) || Object.keys(inApp).length === 0) {
    throw createPreferenceError('inApp must be an object with at least one category', 'INVALID_PREFERENCES_INPUT');
  }

  for (const [category, enabled] of Object.entries(inApp)) {
    if (!CATEGORY_NAMES.includes(category)) {
      throw createPreferenceError(`Unknown notification category: ${category}`, 'UNKNOWN_CATEGORY');
    }

    if (typeof enabled !== 'boolean') {
      throw createPreferenceError(`${category} must be true or false`);
    }
  }

  return { inApp };
}

async function updateNotificationPreferences(userId, input) {
  const { inApp } = validatePreferencesInput(input);

  await pool.query(
    `
      INSERT INTO notification_preferences (user_id, in_app)
      VALUES ($1, $2::JSONB)
      ON CONFLICT (user_id)
        DO UPDATE SET in_app = notification_preferences.in_app || EXCLUDED.in_app;
    `,
    [userId, JSON.stringify(inApp)],
  );

  return getNotificationPreferences(userId);
}

async function isInAppNotificationEnabled(userId, type, client = pool) {
  const category = categoryForType(type);

  if (!category) {
    return true;
  }

  const result = await client.query(
    `
      SELECT 1
      FROM notification_preferences
      WHERE user_id = $1
        AND in_app ->> $2 = 'false'
    `,
    [userId, category],
  );

  return result.rowCount === 0;
}

module.exports = {
  NOTIFICATION_CATEGORIES,
  categoryForType,
  getNotificationPreferences,
  updateNotificationPreferences,
  isInAppNotificationEnabled,
};
