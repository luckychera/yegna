const { pool } = require('../../config/database');
const { getCurrentUserIdentity } = require('../identity/identity.service');

function createUserError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function buildFullName(row) {
  const displayName = row.display_name && row.display_name.trim();

  if (displayName) {
    return displayName;
  }

  const fullName = [row.first_name, row.last_name]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ');

  return fullName || null;
}

// Profile of the authenticated user. Never selects password_hash, and identity
// data is limited to the provider and verification status: the national ID
// (provider_subject) is not returned in any form.
async function getCurrentUserProfile(userId) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.phone,
        u.status,
        u.email_verified_at,
        u.phone_verified_at,
        u.last_login_at,
        u.created_at,
        up.first_name,
        up.middle_name,
        up.last_name,
        up.display_name,
        up.avatar_url,
        up.preferred_language,
        up.timezone
      FROM users u
      LEFT JOIN user_profiles up
        ON up.user_id = u.id
      WHERE u.id = $1
        AND u.deleted_at IS NULL;
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    throw createUserError('User not found', 404, 'USER_NOT_FOUND');
  }

  const row = result.rows[0];
  const identity = await getCurrentUserIdentity(userId);
  const hasProfile = row.first_name !== null || row.last_name !== null;

  return {
    user: {
      id: row.id,
      email: row.email,
      phone: row.phone,
      status: row.status,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    },
    profile: hasProfile
      ? {
          firstName: row.first_name,
          middleName: row.middle_name,
          lastName: row.last_name,
          displayName: row.display_name,
          fullName: buildFullName(row),
          avatarUrl: row.avatar_url,
          preferredLanguage: row.preferred_language,
          timezone: row.timezone,
        }
      : null,
    identity: identity
      ? {
          provider: identity.provider,
          verificationStatus: identity.verificationStatus,
          verifiedAt: identity.verifiedAt,
        }
      : null,
  };
}

module.exports = {
  getCurrentUserProfile,
};
