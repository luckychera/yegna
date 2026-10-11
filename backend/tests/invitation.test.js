const test = require('node:test');
const assert = require('node:assert/strict');

const { pool, closeDatabase } = require('../src/config/database');

const { createCommunity } = require('../src/modules/community/community.service');

const { createMembership } = require('../src/modules/membership/membership.service');

const {
  createInvitation,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
} = require('../src/modules/invitation/invitation.service');

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@yegna.test`;
}

test.after(async () => {
  await closeDatabase();
});

async function createTestUser(prefix) {
  const result = await pool.query(
    `
      INSERT INTO users (
        email,
        status
      )
      VALUES ($1, 'active')
      RETURNING id, email, status;
    `,
    [uniqueEmail(prefix)],
  );

  return result.rows[0];
}

async function createTestCommunity(userId) {
  const result = await createCommunity({
    userId,
    name: `Invitation Test ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: 'Automated invitation integration test',
    communityType: 'association',
    logoUrl: null,
  });

  return result.community;
}

async function createFixture({ includeSecondInvitedUser = false } = {}) {
  const inviter = await createTestUser('inviter');
  const invitedUser = await createTestUser('invited');

  const secondInvitedUser = includeSecondInvitedUser
    ? await createTestUser('second-invited')
    : null;

  const community = await createTestCommunity(inviter.id);

  return {
    inviter,
    invitedUser,
    secondInvitedUser,
    community,
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) {
    return;
  }

  const userIds = [
    fixture.inviter?.id,
    fixture.invitedUser?.id,
    fixture.secondInvitedUser?.id,
  ].filter(Boolean);

  /*
   * Delete the community first.
   *
   * This cascades to:
   * - memberships
   * - invitations
   * - community roles
   * - community settings
   * - other community-owned records
   */
  if (fixture.community?.id) {
    await pool.query(
      `
        DELETE FROM communities
        WHERE id = $1;
      `,
      [fixture.community.id],
    );
  }

  /*
   * Audit logs use ON DELETE SET NULL for user_id,
   * so deleting the users is safe after the community
   * and community-owned records are gone.
   */
  if (userIds.length > 0) {
    await pool.query(
      `
        DELETE FROM users
        WHERE id = ANY($1::uuid[]);
      `,
      [userIds],
    );
  }
}

async function createPendingInvitation(fixture) {
  return createInvitation({
    communityId: fixture.community.id,
    inviterUserId: fixture.inviter.id,
    invitedUserId: fixture.invitedUser.id,
    metadata: {
      test: true,
      source: 'automated-test',
    },
  });
}

/*
 * 1. Self invitation
 */
test('rejects self invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await assert.rejects(
      createInvitation({
        communityId: fixture.community.id,
        inviterUserId: fixture.inviter.id,
        invitedUserId: fixture.inviter.id,
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 2. Existing membership
 */
test('rejects invitation when invited user is already a member', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await createMembership({
      communityId: fixture.community.id,
      userId: fixture.invitedUser.id,
      actorUserId: fixture.inviter.id,
      initialStatus: 'active',
      metadata: {
        source: 'automated-test',
      },
    });

    await assert.rejects(
      createInvitation({
        communityId: fixture.community.id,
        inviterUserId: fixture.inviter.id,
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 3. Duplicate pending invitation
 */
test('rejects duplicate pending invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const firstInvitation = await createPendingInvitation(fixture);

    assert.equal(firstInvitation.status, 'pending');

    await assert.rejects(createPendingInvitation(fixture), (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 4. Invalid invitation token
 */
test('rejects invalid invitation token', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await assert.rejects(
      acceptInvitation({
        invitationToken: 'definitely-not-a-valid-invitation-token',
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 5. Wrong user attempts to accept invitation
 */
test('rejects invitation acceptance by the wrong user', async () => {
  let fixture;

  try {
    fixture = await createFixture({
      includeSecondInvitedUser: true,
    });

    const invitation = await createPendingInvitation(fixture);

    await assert.rejects(
      acceptInvitation({
        invitationToken: invitation.token,
        invitedUserId: fixture.secondInvitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );

    const storedInvitation = await pool.query(
      `
        SELECT status
        FROM community_invitations
        WHERE id = $1;
      `,
      [invitation.id],
    );

    assert.equal(storedInvitation.rows[0].status, 'pending');
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 6. Expired invitation
 */
test('rejects expired invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const invitation = await createPendingInvitation(fixture);

    await pool.query(
      `
        UPDATE community_invitations
        SET expires_at = NOW() - INTERVAL '1 minute'
        WHERE id = $1;
      `,
      [invitation.id],
    );

    await assert.rejects(
      acceptInvitation({
        invitationToken: invitation.token,
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );

    const storedInvitation = await pool.query(
      `
        SELECT status
        FROM community_invitations
        WHERE id = $1;
      `,
      [invitation.id],
    );

    assert.equal(storedInvitation.rows[0].status, 'expired');
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 7. Rejected invitation
 */
test('rejects acceptance of a rejected invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const invitation = await createPendingInvitation(fixture);

    const rejected = await rejectInvitation(invitation.id, fixture.invitedUser.id);

    assert.equal(rejected.status, 'rejected');

    await assert.rejects(
      acceptInvitation({
        invitationToken: invitation.token,
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 8. Revoked invitation
 */
test('rejects acceptance of a revoked invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const invitation = await createPendingInvitation(fixture);

    const revoked = await revokeInvitation(invitation.id, fixture.inviter.id);

    assert.equal(revoked.status, 'revoked');

    await assert.rejects(
      acceptInvitation({
        invitationToken: invitation.token,
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 9. Already accepted invitation
 */
test('rejects accepting an invitation twice', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const invitation = await createPendingInvitation(fixture);

    const firstResult = await acceptInvitation({
      invitationToken: invitation.token,
      invitedUserId: fixture.invitedUser.id,
    });

    assert.equal(firstResult.invitation.status, 'accepted');

    assert.equal(firstResult.membership.status, 'active');

    await assert.rejects(
      acceptInvitation({
        invitationToken: invitation.token,
        invitedUserId: fixture.invitedUser.id,
      }),
      (error) => {
        assert.ok(error.statusCode >= 400);
        assert.ok(error.statusCode < 500);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 10. Full successful flow
 *
 * Keep the original happy-path test as a regression test.
 */
test('creates and accepts a community invitation', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const invitation = await createPendingInvitation(fixture);

    assert.ok(invitation.id);
    assert.equal(invitation.status, 'pending');
    assert.ok(invitation.token);
    assert.ok(invitation.expires_at);

    const storedInvitation = await pool.query(
      `
        SELECT
          id,
          status,
          token_hash,
          invited_user_id,
          inviter_user_id,
          community_id
        FROM community_invitations
        WHERE id = $1;
      `,
      [invitation.id],
    );

    assert.equal(storedInvitation.rows.length, 1);

    const stored = storedInvitation.rows[0];

    assert.equal(stored.status, 'pending');
    assert.equal(stored.invited_user_id, fixture.invitedUser.id);
    assert.equal(stored.inviter_user_id, fixture.inviter.id);
    assert.equal(stored.community_id, fixture.community.id);

    assert.ok(stored.token_hash);
    assert.notEqual(stored.token_hash, invitation.token);

    const result = await acceptInvitation({
      invitationToken: invitation.token,
      invitedUserId: fixture.invitedUser.id,
    });

    assert.ok(result.invitation);
    assert.ok(result.membership);

    assert.equal(result.invitation.status, 'accepted');

    assert.equal(result.membership.community_id, fixture.community.id);

    assert.equal(result.membership.user_id, fixture.invitedUser.id);

    assert.equal(result.membership.status, 'active');

    assert.ok(result.membership.joined_at);
    assert.ok(result.membership.approved_at);

    assert.deepEqual(result.membership.metadata, {
      source: 'invitation',
      invitationId: invitation.id,
    });

    const auditResult = await pool.query(
      `
        SELECT action
        FROM audit_logs
        WHERE entity_id IN ($1, $2)
        ORDER BY created_at ASC;
      `,
      [invitation.id, result.membership.id],
    );

    const auditActions = auditResult.rows.map((row) => row.action);

    assert.ok(auditActions.includes('invitation.created'));

    assert.ok(auditActions.includes('invitation.accepted'));

    assert.ok(auditActions.includes('membership.created'));
  } finally {
    await cleanupFixture(fixture);
  }
});
