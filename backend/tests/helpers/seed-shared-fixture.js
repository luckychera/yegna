/**
 * Several test files share one long-lived community and administrator, referenced by
 * fixed IDs. This script creates them when they are missing so the suite also runs
 * against a freshly migrated database. It is idempotent and runs before `npm test`.
 */
const { pool, closeDatabase } = require('../../src/config/database');
const { PERMISSIONS } = require('../../src/modules/authorization/permission.constants');

const SHARED_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';
const SHARED_ADMIN_USER_ID = 'dd073edc-85d6-4665-bce9-e64d2ae6de2f';

async function ensureSharedTestFixture() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO users (id, email, password_hash, status)
        VALUES ($1, 'shared-test-admin@yegna.test', 'not-a-real-hash', 'active')
        ON CONFLICT (id) DO NOTHING;
      `,
      [SHARED_ADMIN_USER_ID],
    );

    await client.query(
      `
        INSERT INTO user_profiles (user_id, first_name, last_name)
        VALUES ($1, 'Shared', 'Admin')
        ON CONFLICT (user_id) DO NOTHING;
      `,
      [SHARED_ADMIN_USER_ID],
    );

    await client.query(
      `
        INSERT INTO communities (id, name, description, community_type, status, created_by)
        VALUES ($1, 'Yegna Shared Test Community', 'Used by the automated test suite', 'equb', 'active', $2)
        ON CONFLICT (id) DO NOTHING;
      `,
      [SHARED_COMMUNITY_ID, SHARED_ADMIN_USER_ID],
    );

    const membership = await client.query(
      `
        INSERT INTO community_memberships (
          community_id, user_id, membership_number, status, joined_at, approved_at
        )
        VALUES ($1, $2, 'TEST-ADMIN', 'active', NOW(), NOW())
        ON CONFLICT (community_id, user_id)
          DO UPDATE SET status = 'active'
        RETURNING id;
      `,
      [SHARED_COMMUNITY_ID, SHARED_ADMIN_USER_ID],
    );

    const role = await client.query(
      `
        INSERT INTO community_roles (community_id, name, description, permissions, is_system_role)
        VALUES ($1, 'admin', 'Community administrator', $2::JSONB, TRUE)
        ON CONFLICT (community_id, name)
          DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id;
      `,
      [SHARED_COMMUNITY_ID, JSON.stringify(Object.values(PERMISSIONS))],
    );

    await client.query(
      `
        INSERT INTO membership_roles (membership_id, role_id, assigned_by)
        SELECT $1, $2, $3
        WHERE NOT EXISTS (
          SELECT 1 FROM membership_roles
          WHERE membership_id = $1 AND role_id = $2 AND revoked_at IS NULL
        );
      `,
      [membership.rows[0].id, role.rows[0].id, SHARED_ADMIN_USER_ID],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  SHARED_COMMUNITY_ID,
  SHARED_ADMIN_USER_ID,
  ensureSharedTestFixture,
};

if (require.main === module) {
  ensureSharedTestFixture()
    .then(() => console.log('Shared test fixture is ready.'))
    .catch((error) => {
      console.error('Failed to prepare the shared test fixture:', error);
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
