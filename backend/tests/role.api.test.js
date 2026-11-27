const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

async function roleId(communityId, name) {
  const result = await pool.query(
    'SELECT id FROM community_roles WHERE community_id = $1 AND name = $2',
    [communityId, name],
  );

  assert.ok(result.rows[0], `missing role ${name}`);

  return result.rows[0].id;
}

async function roleNames(membershipId) {
  const result = await pool.query(
    `
      SELECT cr.name
      FROM membership_roles mr
      JOIN community_roles cr ON cr.id = mr.role_id
      WHERE mr.membership_id = $1
        AND mr.revoked_at IS NULL
      ORDER BY cr.name
    `,
    [membershipId],
  );

  return result.rows.map((row) => row.name);
}

function authFor(user) {
  return ctx.request('GET', '/authorization/me', { token: user.token });
}

test('a direct join becomes a member and a pending request has no role', async () => {
  const admin = await ctx.createUser();
  const joiner = await ctx.createUser();
  const applicant = await ctx.createUser();
  const open = await ctx.createTestCommunity(admin, { requiresApproval: false });
  const closed = await ctx.createTestCommunity(admin);

  const joined = await ctx.request('POST', `/communities/${open.id}/join`, { token: joiner.token });
  const requested = await ctx.request('POST', `/communities/${closed.id}/join`, { token: applicant.token });

  assert.equal(joined.status, 201);
  assert.equal(joined.body.data.membership.status, 'active');
  assert.match(joined.body.data.membership.membershipNumber, /^YG-/);
  assert.deepEqual(await roleNames(joined.body.data.membership.id), ['member']);

  assert.equal(requested.body.data.membership.status, 'pending');
  assert.equal(requested.body.data.membership.membershipNumber, null);
  assert.deepEqual(await roleNames(requested.body.data.membership.id), []);

  const authorization = await authFor(joiner);
  const community = authorization.body.data.communities.find((item) => item.communityId === open.id);

  assert.deepEqual(community.roles.map((role) => role.name), ['member']);
  assert.deepEqual(community.permissions, ['community.view', 'members.invite']);
  assert.equal(
    authorization.body.data.communities.some((item) => item.communityId === closed.id),
    false,
  );
});

test('an admin invitation stores a role and applies it only when the membership becomes active', async () => {
  const admin = await ctx.createUser();
  const guest = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  const treasurer = await roleId(community.id, 'treasurer');

  const created = await ctx.request('POST', `/communities/${community.id}/invitations`, {
    token: admin.token,
    body: { email: guest.email, roleId: treasurer },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.role.name, 'treasurer');
  assert.equal(created.body.data.role_id, treasurer);

  const before = await authFor(guest);
  assert.equal(
    before.body.data.communities.some((item) => item.communityId === community.id),
    false,
  );

  const accepted = await ctx.request('POST', `/invitations/${created.body.data.id}/accept`, {
    token: guest.token,
  });
  const duplicate = await ctx.request('POST', `/invitations/${created.body.data.id}/accept`, {
    token: guest.token,
  });

  assert.equal(accepted.status, 200);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'INVALID_INVITATION_STATUS');

  const membershipId = await ctx.getMembershipId(community.id, guest.id);
  const stored = await pool.query(
    'SELECT status, membership_number FROM community_memberships WHERE id = $1',
    [membershipId],
  );

  assert.equal(stored.rows[0].status, 'active');
  assert.match(stored.rows[0].membership_number, /^YG-/);
  assert.deepEqual(await roleNames(membershipId), ['treasurer']);

  const after = await authFor(guest);
  const communityAuth = after.body.data.communities.find((item) => item.communityId === community.id);

  assert.ok(communityAuth.permissions.includes('finance.view'));
  assert.equal(communityAuth.permissions.includes('roles.assign'), false);
});

test('an ordinary member invitation is always the member role, including a crafted privileged role', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const guest = await ctx.createUser();
  const crafted = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);

  const allowed = await ctx.request('POST', `/communities/${community.id}/invitations`, {
    token: member.token,
    body: { invitedUserId: guest.id },
  });
  const denied = await ctx.request('POST', `/communities/${community.id}/invitations`, {
    token: member.token,
    body: { invitedUserId: crafted.id, roleId: await roleId(community.id, 'admin') },
  });

  assert.equal(allowed.status, 201);
  assert.equal(allowed.body.data.role.name, 'member');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'ROLE_ASSIGNMENT_DENIED');

  const accepted = await ctx.request('POST', `/invitations/${allowed.body.data.id}/accept`, {
    token: guest.token,
  });

  assert.equal(accepted.status, 200);
  assert.deepEqual(await roleNames(await ctx.getMembershipId(community.id, guest.id)), ['member']);
});

test('only the community creator can appoint an admin, and nobody can change their own role', async () => {
  const creator = await ctx.createUser();
  const second = await ctx.createUser();
  const target = await ctx.createUser();
  const outsider = await ctx.createUser();
  const community = await ctx.createTestCommunity(creator);
  await ctx.addActiveMember(community.id, second, creator.id);
  await ctx.addActiveMember(community.id, target, creator.id);

  const secondMembership = await ctx.getMembershipId(community.id, second.id);
  const creatorMembership = await ctx.getMembershipId(community.id, creator.id);
  const adminRole = await roleId(community.id, 'admin');

  const appointed = await ctx.request('POST', `/communities/${community.id}/members/${secondMembership}/role`, {
    token: creator.token,
    body: { roleId: adminRole },
  });
  const self = await ctx.request('POST', `/communities/${community.id}/members/${creatorMembership}/role`, {
    token: creator.token,
    body: { roleId: await roleId(community.id, 'member') },
  });
  const bySecond = await ctx.request('POST', `/communities/${community.id}/invitations`, {
    token: second.token,
    body: { email: outsider.email, roleId: adminRole },
  });

  assert.equal(appointed.status, 200);
  assert.equal(appointed.body.data.role.name, 'admin');
  assert.equal(self.status, 403);
  assert.equal(self.body.error.code, 'SELF_ROLE_CHANGE');
  assert.equal(bySecond.status, 403);
  assert.equal(bySecond.body.error.code, 'ROLE_ASSIGNMENT_DENIED');

  const assignable = await ctx.request('GET', `/communities/${community.id}/roles/assignable`, {
    token: second.token,
  });

  assert.equal(assignable.status, 200);
  assert.equal(assignable.body.data.roles.some((role) => role.name === 'admin'), false);
  assert.equal(assignable.body.data.roles.some((role) => role.name === 'treasurer'), true);
});

test('an authorized admin can promote and demote, and the change is audited', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);
  const membershipId = await ctx.getMembershipId(community.id, member.id);

  const promoted = await ctx.request('POST', `/communities/${community.id}/members/${membershipId}/role`, {
    token: admin.token,
    body: { roleId: await roleId(community.id, 'secretary') },
  });
  const demoted = await ctx.request('POST', `/communities/${community.id}/members/${membershipId}/role`, {
    token: admin.token,
    body: { roleId: await roleId(community.id, 'member') },
  });
  const forbidden = await ctx.request('POST', `/communities/${community.id}/members/${membershipId}/role`, {
    token: member.token,
    body: { roleId: await roleId(community.id, 'admin') },
  });

  assert.equal(promoted.status, 200);
  assert.equal(demoted.status, 200);
  assert.equal(demoted.body.data.role.name, 'member');
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await roleNames(membershipId), ['member']);

  const audit = await pool.query(
    `
      SELECT action, old_values, new_values
      FROM audit_logs
      WHERE community_id = $1
        AND entity_id = $2
        AND action = 'role.changed'
      ORDER BY created_at
    `,
    [community.id, membershipId],
  );

  assert.equal(audit.rows.length >= 2, true);
  assert.equal(audit.rows.at(-1).new_values.role, 'member');
  assert.deepEqual(audit.rows.at(-1).old_values.roles, ['secretary']);
});

test('the last active administrator cannot be removed by another role manager', async () => {
  const creator = await ctx.createUser();
  const successor = await ctx.createUser();
  const treasurer = await ctx.createUser();
  const community = await ctx.createTestCommunity(creator, { requiresApproval: false });
  await ctx.addActiveMember(community.id, successor, creator.id);
  await ctx.addActiveMember(community.id, treasurer, creator.id);

  const successorMembership = await ctx.getMembershipId(community.id, successor.id);

  const appointed = await ctx.request('POST', `/communities/${community.id}/members/${successorMembership}/role`, {
    token: creator.token,
    body: { roleId: await roleId(community.id, 'admin') },
  });

  assert.equal(appointed.status, 200);

  const left = await ctx.request('POST', `/communities/${community.id}/leave`, { token: creator.token });
  assert.equal(left.status, 200);

  await pool.query(
    `
      UPDATE community_roles
      SET permissions = permissions || '["roles.assign"]'::JSONB
      WHERE community_id = $1
        AND name = 'treasurer'
    `,
    [community.id],
  );

  const treasurerMembership = await ctx.getMembershipId(community.id, treasurer.id);

  await ctx.request('POST', `/communities/${community.id}/members/${treasurerMembership}/role`, {
    token: successor.token,
    body: { roleId: await roleId(community.id, 'treasurer') },
  });

  const blocked = await ctx.request(
    'POST',
    `/communities/${community.id}/members/${successorMembership}/role`,
    {
      token: treasurer.token,
      body: { roleId: await roleId(community.id, 'member') },
    },
  );

  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'LAST_ADMINISTRATOR');
  assert.deepEqual(await roleNames(successorMembership), ['admin']);
});

test('approving a join request assigns the member role and a membership number', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  const requested = await ctx.request('POST', `/communities/${community.id}/join`, { token: applicant.token });

  assert.equal(requested.status, 201);
  assert.deepEqual(await roleNames(requested.body.data.membership.id), []);

  const approved = await ctx.request(
    'POST',
    `/communities/${community.id}/members/${requested.body.data.membership.id}/approve`,
    { token: admin.token },
  );

  assert.equal(approved.status, 200);
  const stored = await pool.query(
    'SELECT status, membership_number FROM community_memberships WHERE id = $1',
    [requested.body.data.membership.id],
  );

  assert.equal(stored.rows[0].status, 'active');
  assert.match(stored.rows[0].membership_number, /^YG-/);
  assert.deepEqual(await roleNames(requested.body.data.membership.id), ['member']);

  const authorization = await authFor(applicant);
  const communityAuth = authorization.body.data.communities.find((item) => item.communityId === community.id);

  assert.deepEqual(communityAuth.permissions, ['community.view', 'members.invite']);
});

test('a repeated accept does not apply a second role', async () => {
  const admin = await ctx.createUser();
  const guest = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const created = await ctx.request('POST', `/communities/${community.id}/invitations`, {
    token: admin.token,
    body: { email: guest.email, roleId: await roleId(community.id, 'committee_member') },
  });

  const [first, second] = await Promise.all([
    ctx.request('POST', `/invitations/${created.body.data.id}/accept`, { token: guest.token }),
    ctx.request('POST', `/invitations/${created.body.data.id}/accept`, { token: guest.token }),
  ]);
  const statuses = [first.status, second.status].sort();

  assert.deepEqual(statuses, [200, 409]);
  assert.deepEqual(
    await roleNames(await ctx.getMembershipId(community.id, guest.id)),
    ['committee_member'],
  );
});
