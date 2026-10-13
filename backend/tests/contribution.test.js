const test = require('node:test');
const assert = require('node:assert/strict');

const { pool, closeDatabase } = require('../src/config/database');

const { createCommunity } = require('../src/modules/community/community.service');

const { createMembership } = require('../src/modules/membership/membership.service');

const {
  createContribution,
  getContributionById,
  listContributions,
  updateContribution,
  changeContributionStatus,
} = require('../src/modules/contribution/contribution.service');

const { CONTRIBUTION_STATUS } = require('../src/modules/contribution/contribution.constants');

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@yegna.test`;
}

function uniqueName(prefix) {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    name: uniqueName('Contribution Test'),
    description: 'Automated contribution integration test',
    communityType: 'association',
    logoUrl: null,
  });

  return result.community;
}

async function createFixture() {
  const admin = await createTestUser('contribution-admin');
  const member = await createTestUser('contribution-member');
  const secondMember = await createTestUser('contribution-member-2');

  const community = await createTestCommunity(admin.id);

  const membership = await createMembership({
    communityId: community.id,
    userId: member.id,
    actorUserId: admin.id,
    initialStatus: 'active',
    metadata: {
      test: true,
      source: 'automated-test',
    },
  });

  const secondMembership = await createMembership({
    communityId: community.id,
    userId: secondMember.id,
    actorUserId: admin.id,
    initialStatus: 'active',
    metadata: {
      test: true,
      source: 'automated-test',
    },
  });

  return {
    admin,
    member,
    secondMember,
    community,
    membership,
    secondMembership,
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) {
    return;
  }

  const userIds = [fixture.admin?.id, fixture.member?.id, fixture.secondMember?.id].filter(Boolean);

  if (fixture.community?.id) {
    await pool.query(
      `
        DELETE FROM communities
        WHERE id = $1;
      `,
      [fixture.community.id],
    );
  }

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

function contributionInput(fixture, overrides = {}) {
  return {
    communityId: fixture.community.id,
    membershipId: fixture.membership.id,
    actorUserId: fixture.admin.id,
    contributionPeriodStart: '2026-10-01',
    contributionPeriodEnd: '2026-10-31',
    dueDate: '2026-10-15',
    amount: '500.00',
    currency: 'ETB',
    notes: 'October community contribution',
    ...overrides,
  };
}

/*
 * 1. Create contribution
 */
test('creates a contribution for an active member', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const contribution = await createContribution(contributionInput(fixture));

    assert.equal(contribution.community_id, fixture.community.id);
    assert.equal(contribution.membership_id, fixture.membership.id);
    assert.equal(contribution.amount, '500.00');
    assert.equal(contribution.currency, 'ETB');
    assert.equal(contribution.status, CONTRIBUTION_STATUS.PENDING);
    assert.equal(contribution.paid_amount, '0.00');
    assert.equal(contribution.notes, 'October community contribution');
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 2. Reject inactive membership
 */
test('rejects contribution for a non-active membership', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await pool.query(
      `
        UPDATE community_memberships
        SET status = 'suspended'
        WHERE id = $1;
      `,
      [fixture.membership.id],
    );

    await assert.rejects(createContribution(contributionInput(fixture)), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 3. Duplicate contribution
 */
test('rejects duplicate contribution for the same membership and period', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await createContribution(contributionInput(fixture));

    await assert.rejects(createContribution(contributionInput(fixture)), (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 4. Get contribution
 */
test('gets a contribution by ID', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    const contribution = await getContributionById(fixture.community.id, created.id);

    assert.equal(contribution.id, created.id);
    assert.equal(contribution.membership_id, fixture.membership.id);
    assert.equal(contribution.amount, '500.00');
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 5. List contributions
 */
test('lists contributions for a community', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    await createContribution(contributionInput(fixture));

    await createContribution(
      contributionInput(fixture, {
        membershipId: fixture.secondMembership.id,
        contributionPeriodStart: '2026-11-01',
        contributionPeriodEnd: '2026-11-30',
        dueDate: '2026-11-15',
        amount: '750.00',
      }),
    );

    const result = await listContributions(fixture.community.id);

    assert.equal(result.length, 2);

    const membershipIds = result.map((item) => item.membership_id);

    assert.ok(membershipIds.includes(fixture.membership.id));
    assert.ok(membershipIds.includes(fixture.secondMembership.id));
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 6. Update contribution
 */
test('updates a pending contribution', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    const updated = await updateContribution(
      fixture.community.id,
      created.id,
      {
        dueDate: '2026-10-20',
        amount: '600.00',
        notes: 'Updated October contribution',
      },
      fixture.admin.id,
    );

    assert.equal(updated.id, created.id);
    assert.equal(updated.amount, '600.00');
    assert.equal(
      updated.due_date.toLocaleDateString('en-CA', {
        timeZone: 'Africa/Addis_Ababa',
      }),
      '2026-10-20',
    );
    assert.equal(updated.notes, 'Updated October contribution');
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 7. Clear notes
 */
test('clears contribution notes when notes is explicitly set to null', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    const updated = await updateContribution(
      fixture.community.id,
      created.id,
      {
        notes: null,
      },
      fixture.admin.id,
    );

    assert.equal(updated.notes, null);
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 8. Waive contribution
 */
test('waives an unpaid contribution', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    const waived = await changeContributionStatus(
      fixture.community.id,
      created.id,
      CONTRIBUTION_STATUS.WAIVED,
      fixture.admin.id,
    );

    assert.equal(waived.id, created.id);
    assert.equal(waived.status, CONTRIBUTION_STATUS.WAIVED);
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 9. Cancel contribution
 */
test('cancels an unpaid contribution', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    const cancelled = await changeContributionStatus(
      fixture.community.id,
      created.id,
      CONTRIBUTION_STATUS.CANCELLED,
      fixture.admin.id,
    );

    assert.equal(cancelled.id, created.id);
    assert.equal(cancelled.status, CONTRIBUTION_STATUS.CANCELLED);
  } finally {
    await cleanupFixture(fixture);
  }
});

/*
 * 10. Prevent modification of finalized contribution
 */
test('rejects updating a waived contribution', async () => {
  let fixture;

  try {
    fixture = await createFixture();

    const created = await createContribution(contributionInput(fixture));

    await changeContributionStatus(
      fixture.community.id,
      created.id,
      CONTRIBUTION_STATUS.WAIVED,
      fixture.admin.id,
    );

    await assert.rejects(
      updateContribution(
        fixture.community.id,
        created.id,
        {
          amount: '700.00',
        },
        fixture.admin.id,
      ),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, 'CONTRIBUTION_NOT_EDITABLE');
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});
