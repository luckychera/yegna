const { pool } = require('../../config/database');
const { escapeLikePattern } = require('../../utils/query-filters');
const { getUserAuthorization } = require('../authorization/authorization.service');

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
  bannerUrl,
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
          logo_url,
          banner_url
        )
        VALUES ($1, $2, $3, 'active', $4, $5, $6)
        RETURNING
          id,
          name,
          description,
          community_type,
          status,
          created_by,
          logo_url,
          banner_url,
          settings,
          created_at,
          updated_at;
      `,
      [name, description, communityType, userId, logoUrl, bannerUrl],
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
        banner_url,
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
    bannerUrl: 'banner_url',
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
        banner_url,
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

const COMMUNITY_SORT_SQL = Object.freeze({
  newest: 'c.created_at DESC, c.id',
  popular: 'member_count DESC, c.name ASC, c.id',
  name: 'LOWER(c.name) ASC, c.id',
});

function toCommunitySummary(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    communityType: row.community_type,
    status: row.status,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    memberCount: row.member_count,
    createdAt: row.created_at,
  };
}

// Browsable directory of active communities. Returns a deliberately small public
// summary: no settings, creator, or metadata.
async function listCommunities({ userId, search, communityType, sort = 'newest', limit, offset }) {
  const filters = ['c.archived_at IS NULL', "c.status = 'active'"];
  const params = [];

  if (search) {
    params.push(`%${escapeLikePattern(search)}%`);
    filters.push(`(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
  }

  if (communityType) {
    params.push(communityType);
    filters.push(`c.community_type = $${params.length}`);
  }

  const where = filters.join(' AND ');

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM communities c
      WHERE ${where};
    `,
    params,
  );

  params.push(userId, limit, offset);
  const userIndex = params.length - 2;
  const limitIndex = params.length - 1;
  const offsetIndex = params.length;

  const result = await pool.query(
    `
      SELECT
        c.id,
        c.name,
        c.description,
        c.community_type,
        c.status,
        c.logo_url,
        c.banner_url,
        c.created_at,
        (
          SELECT COUNT(*)::INT
          FROM community_memberships m
          WHERE m.community_id = c.id
            AND m.status = 'active'
        ) AS member_count,
        my.id AS my_membership_id,
        my.status AS my_membership_status
      FROM communities c
      LEFT JOIN community_memberships my
        ON my.community_id = c.id
       AND my.user_id = $${userIndex}
      WHERE ${where}
      ORDER BY ${COMMUNITY_SORT_SQL[sort]}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex};
    `,
    params,
  );

  return {
    communities: result.rows.map((row) => ({
      ...toCommunitySummary(row),
      myMembership: row.my_membership_id
        ? { id: row.my_membership_id, status: row.my_membership_status }
        : null,
    })),
    total: countResult.rows[0].total,
  };
}

// The caller's own memberships (any status) with community info. Roles and
// permissions come from the existing authorization service, so they only exist
// for active memberships, exactly as the rest of the API treats them.
async function listMyCommunities({ userId, statuses, limit, offset }) {
  const countResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM community_memberships cm
      JOIN communities c
        ON c.id = cm.community_id
       AND c.archived_at IS NULL
      WHERE cm.user_id = $1
        AND cm.status = ANY($2::VARCHAR[]);
    `,
    [userId, statuses],
  );

  const result = await pool.query(
    `
      SELECT
        c.id,
        c.name,
        c.description,
        c.community_type,
        c.status,
        c.logo_url,
        c.banner_url,
        c.created_at,
        (
          SELECT COUNT(*)::INT
          FROM community_memberships m
          WHERE m.community_id = c.id
            AND m.status = 'active'
        ) AS member_count,
        cm.id AS membership_id,
        cm.status AS membership_status,
        cm.membership_number,
        cm.joined_at
      FROM community_memberships cm
      JOIN communities c
        ON c.id = cm.community_id
       AND c.archived_at IS NULL
      WHERE cm.user_id = $1
        AND cm.status = ANY($2::VARCHAR[])
      ORDER BY cm.joined_at DESC NULLS LAST, cm.created_at DESC, cm.id
      LIMIT $3
      OFFSET $4;
    `,
    [userId, statuses, limit, offset],
  );

  const authorizations = await getUserAuthorization(userId);
  const authorizationByCommunity = new Map(
    authorizations.map((authorization) => [authorization.communityId, authorization]),
  );

  return {
    memberships: result.rows.map((row) => {
      const authorization = authorizationByCommunity.get(row.id);

      return {
        community: toCommunitySummary(row),
        membership: {
          id: row.membership_id,
          status: row.membership_status,
          membershipNumber: row.membership_number,
          joinedAt: row.joined_at,
        },
        roles: authorization ? authorization.roles : [],
        permissions: authorization ? authorization.permissions : [],
      };
    }),
    total: countResult.rows[0].total,
  };
}

module.exports = {
  createCommunity,
  getCommunityById,
  updateCommunity,
  listCommunities,
  listMyCommunities,
};
