const { pool } = require('../../config/database');

function createCommunityError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function createCommunity({
  userId,
  name,
  description,
  communityType,
  logoUrl,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const communityResult = await client.query(
      `
        INSERT INTO communities (
          name,
          description,
          community_type,
          status,
          created_by,
          logo_url
        )
        VALUES ($1, $2, $3, 'active', $4, $5)
        RETURNING
          id,
          name,
          description,
          community_type,
          status,
          created_by,
          logo_url,
          settings,
          created_at,
          updated_at;
      `,
      [name, description, communityType, userId, logoUrl],
    );

    const community = communityResult.rows[0];

    const membershipResult = await client.query(
      `
        INSERT INTO community_memberships (
          community_id,
          user_id,
          membership_number,
          status,
          joined_at,
          approved_at
        )
        VALUES (
          $1,
          $2,
          NULL,
          'active',
          NOW(),
          NOW()
        )
        RETURNING
          id,
          community_id,
          user_id,
          membership_number,
          status,
          joined_at,
          approved_at;
      `,
      [community.id, userId],
    );

    const membership = membershipResult.rows[0];

    const roleResult = await client.query(
      `
        INSERT INTO community_roles (
          community_id,
          name,
          description,
          permissions,
          is_system_role
        )
        VALUES (
          $1,
          'admin',
          'Community administrator',
          $2::JSONB,
          TRUE
        )
        RETURNING
          id,
          community_id,
          name,
          description,
          permissions,
          is_system_role;
      `,
      [
        community.id,
        JSON.stringify([
          'community.view',
          'community.update',
          'members.view',
          'members.invite',
          'members.update',
          'members.remove',
          'roles.view',
          'roles.assign',
          'roles.revoke',
          'contributions.view',
          'contributions.create',
          'contributions.update',
          'finance.view',
          'finance.manage',
          'payments.view',
          'payments.create',
          'payments.refund',
          'reports.view',
          'reports.export',
          'audit.view',
        ]),
      ],
    );

    const role = roleResult.rows[0];

    await client.query(
      `
        INSERT INTO membership_roles (
          membership_id,
          role_id,
          assigned_at,
          assigned_by
        )
        VALUES ($1, $2, NOW(), $3);
      `,
      [membership.id, role.id, userId],
    );

    await client.query('COMMIT');

    return {
      community,
      membership,
      role,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createCommunityError(
        'A community with these details already exists',
        409,
        'COMMUNITY_ALREADY_EXISTS',
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getCommunityById(communityId) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        description,
        community_type,
        status,
        created_by,
        logo_url,
        settings,
        created_at,
        updated_at,
        archived_at
      FROM communities
      WHERE id = $1
        AND archived_at IS NULL;
    `,
    [communityId],
  );

  if (result.rows.length === 0) {
    throw createCommunityError(
      'Community not found',
      404,
      'COMMUNITY_NOT_FOUND',
    );
  }

  return result.rows[0];
}

async function updateCommunity(communityId, updates) {
  const fields = [];
  const values = [];
  let parameterIndex = 1;

  const fieldMap = {
    name: 'name',
    description: 'description',
    communityType: 'community_type',
    logoUrl: 'logo_url',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${parameterIndex}`);
      values.push(updates[key]);
      parameterIndex += 1;
    }
  }

  values.push(communityId);

  const result = await pool.query(
    `
      UPDATE communities
      SET ${fields.join(', ')}
      WHERE id = $${parameterIndex}
        AND archived_at IS NULL
      RETURNING
        id,
        name,
        description,
        community_type,
        status,
        created_by,
        logo_url,
        settings,
        created_at,
        updated_at,
        archived_at;
    `,
    values,
  );

  if (result.rows.length === 0) {
    throw createCommunityError(
      'Community not found',
      404,
      'COMMUNITY_NOT_FOUND',
    );
  }

  return result.rows[0];
}

module.exports = {
  createCommunity,
  getCommunityById,
  updateCommunity,
};
