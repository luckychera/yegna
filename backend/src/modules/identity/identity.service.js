const { pool } = require('../../config/database');

async function getCurrentUserIdentity(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        provider,
        provider_subject,
        verification_status,
        verified_at,
        created_at,
        updated_at
      FROM identities
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `,
    [userId],
  );

  const identity = result.rows[0];

  if (!identity) {
    return null;
  }

  return {
    id: identity.id,
    provider: identity.provider,
    verificationStatus: identity.verification_status,
    verifiedAt: identity.verified_at,
    createdAt: identity.created_at,
    updatedAt: identity.updated_at,
  };
}

module.exports = {
  getCurrentUserIdentity,
};
