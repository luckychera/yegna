const { pool } = require('../../config/database');

function createMembershipError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function ensureCommunityExists(communityId) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        status
      FROM communities
      WHERE id = $1
        AND archived_at IS NULL;
    `,
    [communityId],
  );

  if (result.rows.length === 0) {
    throw createMembershipError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
  }

  return result.rows[0];
}

async function ensureUserExists(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        email,
        phone,
        status
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL;
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    throw createMembershipError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (result.rows[0].status !== 'active') {
    throw createMembershipError('User account is not active', 400, 'USER_NOT_ACTIVE');
  }

  return result.rows[0];
}

async function getMembershipSettings(communityId) {
  const result = await pool.query(
    `
      SELECT
        membership_requires_approval,
        allow_member_invites
      FROM community_settings
      WHERE community_id = $1;
    `,
    [communityId],
  );

  if (result.rows.length === 0) {
    return {
      membershipRequiresApproval: true,
      allowMemberInvites: false,
    };
  }

  return {
    membershipRequiresApproval: result.rows[0].membership_requires_approval,
    allowMemberInvites: result.rows[0].allow_member_invites,
  };
}

async function listMembers(communityId) {
  await ensureCommunityExists(communityId);

  const result = await pool.query(
    `
      SELECT
        cm.id,
        cm.community_id,
        cm.user_id,
        cm.membership_number,
        cm.status,
        cm.joined_at,
        cm.approved_at,
        cm.left_at,
        cm.metadata,
        cm.created_at,
        cm.updated_at,

        u.email,
        u.phone,

        up.first_name,
        up.middle_name,
        up.last_name,
        up.display_name
      FROM community_memberships cm
      JOIN users u
        ON u.id = cm.user_id
      LEFT JOIN user_profiles up
        ON up.user_id = u.id
      WHERE cm.community_id = $1
      ORDER BY cm.created_at ASC;
    `,
    [communityId],
  );

  return result.rows;
}

async function getMembershipById(communityId, membershipId) {
  const result = await pool.query(
    `
      SELECT
        cm.id,
        cm.community_id,
        cm.user_id,
        cm.membership_number,
        cm.status,
        cm.joined_at,
        cm.approved_at,
        cm.left_at,
        cm.metadata,
        cm.created_at,
        cm.updated_at,

        u.email,
        u.phone,

        up.first_name,
        up.middle_name,
        up.last_name,
        up.display_name
      FROM community_memberships cm
      JOIN users u
        ON u.id = cm.user_id
      LEFT JOIN user_profiles up
        ON up.user_id = u.id
      WHERE cm.community_id = $1
        AND cm.id = $2;
    `,
    [communityId, membershipId],
  );

  if (result.rows.length === 0) {
    throw createMembershipError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  return result.rows[0];
}

async function createMembership({ communityId, userId, membershipNumber, metadata }) {
  await ensureCommunityExists(communityId);
  await ensureUserExists(userId);

  const settings = await getMembershipSettings(communityId);

  const status = settings.membershipRequiresApproval ? 'pending' : 'active';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
        SELECT
          id,
          status
        FROM community_memberships
        WHERE community_id = $1
          AND user_id = $2
        FOR UPDATE;
      `,
      [communityId, userId],
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      if (
        existing.status === 'active' ||
        existing.status === 'pending' ||
        existing.status === 'suspended'
      ) {
        throw createMembershipError(
          'User already has a membership in this community',
          409,
          'MEMBERSHIP_ALREADY_EXISTS',
        );
      }

      const result = await client.query(
        `
    UPDATE community_memberships
    SET
      membership_number = $1::VARCHAR(50),
      status = $2::VARCHAR(32),
      joined_at = CASE
        WHEN $2::VARCHAR(32) = 'active'
          THEN COALESCE(joined_at, NOW())
        ELSE NULL
      END,
      approved_at = CASE
        WHEN $2::VARCHAR(32) = 'active'
          THEN NOW()
        ELSE NULL
      END,
      left_at = NULL,
      metadata = $3::JSONB
    WHERE id = $4
    RETURNING
      id,
      community_id,
      user_id,
      membership_number,
      status,
      joined_at,
      approved_at,
      left_at,
      metadata,
      created_at,
      updated_at;
  `,
        [membershipNumber, status, JSON.stringify(metadata), existing.id],
      );

      await client.query('COMMIT');

      return result.rows[0];
    }

    const result = await client.query(
      `
    INSERT INTO community_memberships (
      community_id,
      user_id,
      membership_number,
      status,
      joined_at,
      approved_at,
      metadata
    )
    VALUES (
      $1,
      $2,
      $3,
      $4::VARCHAR(32),
      CASE
        WHEN $4::VARCHAR(32) = 'active' THEN NOW()
        ELSE NULL
      END,
      CASE
        WHEN $4::VARCHAR(32) = 'active' THEN NOW()
        ELSE NULL
      END,
      $5::JSONB
    )
    RETURNING
      id,
      community_id,
      user_id,
      membership_number,
      status,
      joined_at,
      approved_at,
      left_at,
      metadata,
      created_at,
      updated_at;
  `,
      [communityId, userId, membershipNumber, status, JSON.stringify(metadata)],
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createMembershipError(
        'A membership with these details already exists',
        409,
        'MEMBERSHIP_ALREADY_EXISTS',
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateMembership(communityId, membershipId, updates) {
  const fields = [];
  const values = [];
  let parameterIndex = 1;

  if (Object.prototype.hasOwnProperty.call(updates, 'membershipNumber')) {
    fields.push(`membership_number = $${parameterIndex}`);
    values.push(updates.membershipNumber);
    parameterIndex += 1;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    fields.push(`metadata = $${parameterIndex}::JSONB`);
    values.push(JSON.stringify(updates.metadata));
    parameterIndex += 1;
  }

  values.push(communityId);
  values.push(membershipId);

  const result = await pool.query(
    `
      UPDATE community_memberships
      SET ${fields.join(', ')}
      WHERE community_id = $${parameterIndex}
        AND id = $${parameterIndex + 1}
      RETURNING
        id,
        community_id,
        user_id,
        membership_number,
        status,
        joined_at,
        approved_at,
        left_at,
        metadata,
        created_at,
        updated_at;
    `,
    values,
  );

  if (result.rows.length === 0) {
    throw createMembershipError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  return result.rows[0];
}

const STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['active', 'rejected']),
  active: Object.freeze(['suspended', 'left']),
  suspended: Object.freeze(['active', 'left']),
  rejected: Object.freeze(['pending']),
  left: Object.freeze(['pending']),
});

async function changeMembershipStatus(communityId, membershipId, newStatus) {
  const current = await getMembershipById(communityId, membershipId);

  const allowedTransitions = STATUS_TRANSITIONS[current.status] || [];

  if (!allowedTransitions.includes(newStatus)) {
    throw createMembershipError(
      `Cannot change membership from ${current.status} to ${newStatus}`,
      400,
      'INVALID_MEMBERSHIP_STATUS_TRANSITION',
    );
  }

  const result = await pool.query(
    `
    UPDATE community_memberships
    SET
      status = $1::VARCHAR(32),
      joined_at = CASE
        WHEN $1::VARCHAR(32) = 'active'
          THEN COALESCE(joined_at, NOW())
        ELSE joined_at
      END,
      approved_at = CASE
        WHEN $1::VARCHAR(32) = 'active'
          THEN NOW()
        ELSE approved_at
      END,
      left_at = CASE
        WHEN $1::VARCHAR(32) = 'left'
          THEN NOW()
        WHEN $1::VARCHAR(32) = 'active'
          THEN NULL
        ELSE left_at
      END
    WHERE community_id = $2
      AND id = $3
    RETURNING
      id,
      community_id,
      user_id,
      membership_number,
      status,
      joined_at,
      approved_at,
      left_at,
      metadata,
      created_at,
      updated_at;
  `,
    [newStatus, communityId, membershipId],
  );

  return result.rows[0];
}

module.exports = {
  listMembers,
  getMembershipById,
  createMembership,
  updateMembership,
  changeMembershipStatus,
};
