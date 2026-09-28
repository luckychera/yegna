require('dotenv').config({ path: './.env' });

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  await client.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE email = 'sara@yegna.local'
          AND deleted_at IS NULL
        LIMIT 1;
      `,
    );

    if (userResult.rows.length === 0) {
      throw new Error(
        'Sara test user was not found. Complete registration first.',
      );
    }

    const userId = userResult.rows[0].id;

    const communityResult = await client.query(
      `
        INSERT INTO communities (
          name,
          description,
          community_type,
          status,
          created_by,
          settings
        )
        VALUES (
          'Yegna Development Community',
          'Development community used for testing Yegna authorization',
          'equb',
          'active',
          $1,
          '{}'::JSONB
        )
        RETURNING id;
      `,
      [userId],
    );

    const communityId = communityResult.rows[0].id;

    const membershipResult = await client.query(
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
          'DEV-00001',
          'active',
          NOW(),
          NOW(),
          '{}'::JSONB
        )
        RETURNING id;
      `,
      [communityId, userId],
    );

    const membershipId = membershipResult.rows[0].id;

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
          'Development administrator role',
          $2::JSONB,
          TRUE
        )
        RETURNING id;
      `,
      [
        communityId,
        JSON.stringify([
          'community.read',
          'community.members.read',
          'community.members.manage',
          'contributions.read',
        ]),
      ],
    );

    const roleId = roleResult.rows[0].id;

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
      [membershipId, roleId, userId],
    );

    await client.query('COMMIT');

    console.log('018 RBAC development seed completed.');
    console.log(`User: ${userId}`);
    console.log(`Community: ${communityId}`);
    console.log(`Membership: ${membershipId}`);
    console.log(`Role: ${roleId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('018 RBAC seed failed:', error);
  process.exit(1);
});
