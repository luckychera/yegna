const { pool } = require('../../config/database');

// The national identifier (provider_subject) is never selected here: no API
// response returns it in any form, not even partially.
async function getCurrentUserIdentity(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        provider,
        verification_status,
        verified_at,
        metadata,
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

  const metadata = identity.metadata || {};
  const mode = metadata.verification_mode;

  return {
    id: identity.id,
    provider: identity.provider,
    verificationStatus: identity.verification_status,
    verifiedAt: identity.verified_at,
    // FIN or FAN: which kind of Fayda number was verified, never the number.
    identifierType: metadata.identifier_type || null,
    // 'mock' records were checked against the development provider, not the
    // government Fayda service. Unknown for records created before this existed.
    verificationMode: mode === 'mock' ? 'mock' : mode ? 'live' : null,
    createdAt: identity.created_at,
    updatedAt: identity.updated_at,
  };
}

module.exports = {
  getCurrentUserIdentity,
};
