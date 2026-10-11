const { pool } = require('../../config/database');

async function createAuditLog({
  userId = null,
  communityId = null,
  action,
  entityType = null,
  entityId = null,
  ipAddress = null,
  userAgent = null,
  oldValues = null,
  newValues = null,
  metadata = {},
  client = pool,
}) {
  if (!action || typeof action !== 'string') {
    const error = new Error('Audit action is required');
    error.statusCode = 400;
    error.code = 'AUDIT_ACTION_REQUIRED';
    throw error;
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    const error = new Error('Audit metadata must be an object');
    error.statusCode = 400;
    error.code = 'INVALID_AUDIT_METADATA';
    throw error;
  }

  if (oldValues !== null && (typeof oldValues !== 'object' || Array.isArray(oldValues))) {
    const error = new Error('Audit old values must be an object or null');
    error.statusCode = 400;
    error.code = 'INVALID_AUDIT_OLD_VALUES';
    throw error;
  }

  if (newValues !== null && (typeof newValues !== 'object' || Array.isArray(newValues))) {
    const error = new Error('Audit new values must be an object or null');
    error.statusCode = 400;
    error.code = 'INVALID_AUDIT_NEW_VALUES';
    throw error;
  }

  const result = await client.query(
    `
      INSERT INTO audit_logs (
        user_id,
        community_id,
        action,
        entity_type,
        entity_id,
        ip_address,
        user_agent,
        old_values,
        new_values,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::JSONB,
        $9::JSONB,
        $10::JSONB
      )
      RETURNING
        id,
        user_id,
        community_id,
        action,
        entity_type,
        entity_id,
        ip_address,
        user_agent,
        old_values,
        new_values,
        metadata,
        created_at;
    `,
    [
      userId,
      communityId,
      action,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      oldValues === null ? null : JSON.stringify(oldValues),
      newValues === null ? null : JSON.stringify(newValues),
      JSON.stringify(metadata),
    ],
  );

  return result.rows[0];
}

module.exports = {
  createAuditLog,
};
