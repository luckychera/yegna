const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

async function communityWithMember() {
  const admin = await ctx.createUser({ firstName: 'Selam', lastName: 'Admin' });
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);

  return { admin, member, community };
}

function publish(community, admin, body = {}) {
  return ctx.request('POST', `/communities/${community.id}/announcements`, {
    token: admin.token,
    body: { title: 'Monthly meeting', body: 'We meet on Sunday after church.', category: 'meeting', ...body },
  });
}

test('an admin publishes an announcement and every other active member is notified', async () => {
  const { admin, member, community } = await communityWithMember();
  const pending = await ctx.createUser();
  await ctx.addActiveMember(community.id, pending, admin.id);
  await ctx.setMembershipStatus(community.id, pending.id, 'pending');

  const response = await publish(community, admin, { eventAt: '2026-12-06T09:00:00.000Z', location: 'Hall' });

  assert.equal(response.status, 201);
  const { announcement, notifiedMembers } = response.body.data;
  assert.equal(announcement.title, 'Monthly meeting');
  assert.equal(announcement.author.name, 'Selam Admin');
  assert.equal(announcement.location, 'Hall');
  assert.equal(announcement.isRead, true, "the author's own announcement is read");
  assert.equal(notifiedMembers, 1);

  const memberNotifications = await pool.query(
    "SELECT type, entity_type, entity_id FROM notifications WHERE user_id = $1 AND type = 'community_announcement'",
    [member.id],
  );
  assert.equal(memberNotifications.rows.length, 1);
  assert.equal(memberNotifications.rows[0].entity_id, announcement.id);

  for (const user of [admin, pending]) {
    const none = await pool.query(
      "SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'community_announcement'",
      [user.id],
    );
    assert.equal(none.rowCount, 0);
  }

  const audit = await pool.query(
    "SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'announcement.published'",
    [announcement.id],
  );
  assert.equal(audit.rowCount, 1);
});

test('a member without announcements.manage cannot publish, edit or remove', async () => {
  const { admin, member, community } = await communityWithMember();
  const { announcement } = (await publish(community, admin)).body.data;

  const create = await publish(community, member);
  const update = await ctx.request('PATCH', `/communities/${community.id}/announcements/${announcement.id}`, {
    token: member.token,
    body: { title: 'Hijacked' },
  });
  const remove = await ctx.request('DELETE', `/communities/${community.id}/announcements/${announcement.id}`, {
    token: member.token,
  });

  for (const response of [create, update, remove]) {
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'PERMISSION_DENIED');
  }
});

test('regular members read announcements; outsiders cannot', async () => {
  const { admin, member, community } = await communityWithMember();
  const outsider = await ctx.createUser();
  await publish(community, admin, { title: 'Pinned notice', category: 'notice', isPinned: true });
  await publish(community, admin, { title: 'Later update', category: 'update' });

  const response = await ctx.request('GET', `/communities/${community.id}/announcements`, { token: member.token });

  assert.equal(response.status, 200);
  const { announcements, unreadCount } = response.body.data;
  assert.deepEqual(announcements.map((item) => item.title), ['Pinned notice', 'Later update']);
  assert.equal(unreadCount, 2);
  assert.ok(announcements.every((item) => item.isRead === false));

  const denied = await ctx.request('GET', `/communities/${community.id}/announcements`, { token: outsider.token });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'COMMUNITY_ACCESS_DENIED');
});

test('marking an announcement read also clears its notification', async () => {
  const { admin, member, community } = await communityWithMember();
  const { announcement } = (await publish(community, admin)).body.data;

  const response = await ctx.request(
    'POST',
    `/communities/${community.id}/announcements/${announcement.id}/read`,
    { token: member.token },
  );
  assert.equal(response.status, 200);

  const detail = await ctx.request('GET', `/communities/${community.id}/announcements/${announcement.id}`, {
    token: member.token,
  });
  assert.equal(detail.body.data.announcement.isRead, true);

  const unread = await ctx.request('GET', '/notifications/unread-count', { token: member.token });
  assert.equal(unread.body.data.unreadCount, 0);
});

test('members who muted announcements are not notified but still see unread announcements', async () => {
  const { admin, member, community } = await communityWithMember();

  await ctx.request('PATCH', '/notifications/preferences', {
    token: member.token,
    body: { inApp: { announcements: false } },
  });

  const { notifiedMembers } = (await publish(community, admin)).body.data;
  assert.equal(notifiedMembers, 0);

  const feed = await ctx.request('GET', `/communities/${community.id}/announcements`, { token: member.token });
  assert.equal(feed.body.data.unreadCount, 1);
});

test('announcements published before a member joined are not shown as unread', async () => {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await publish(community, admin);

  const newcomer = await ctx.createUser();
  await ctx.addActiveMember(community.id, newcomer, admin.id);

  const feed = await ctx.request('GET', `/communities/${community.id}/announcements`, { token: newcomer.token });
  assert.equal(feed.body.data.announcements.length, 1);
  assert.equal(feed.body.data.unreadCount, 0);
});

test('editing and removing an announcement', async () => {
  const { admin, member, community } = await communityWithMember();
  const { announcement } = (await publish(community, admin)).body.data;
  const path = `/communities/${community.id}/announcements/${announcement.id}`;

  const updated = await ctx.request('PATCH', path, {
    token: admin.token,
    body: { title: 'Meeting moved', isPinned: true, location: null },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.announcement.title, 'Meeting moved');
  assert.equal(updated.body.data.announcement.isPinned, true);

  const removed = await ctx.request('DELETE', path, { token: admin.token });
  assert.equal(removed.status, 200);

  assert.equal((await ctx.request('GET', path, { token: member.token })).status, 404);

  const notifications = await ctx.request('GET', '/notifications', { token: member.token });
  assert.ok(
    notifications.body.data.every((notification) => notification.entityId !== announcement.id
      && notification.entity_id !== announcement.id),
    'notifications for a removed announcement are withdrawn',
  );
});

test('announcement input is validated', async () => {
  const { admin, community } = await communityWithMember();

  for (const body of [
    { title: '', body: 'x' },
    { title: 'Valid title', body: '   ' },
    { title: 'Valid title', body: 'x', category: 'advert' },
    { title: 'Valid title', body: 'x', eventAt: 'next week' },
    { title: 'Valid title', body: 'x', isPinned: 'yes' },
    { title: 'Valid title', body: 'x', authorUserId: admin.id },
  ]) {
    const response = await ctx.request('POST', `/communities/${community.id}/announcements`, {
      token: admin.token,
      body,
    });

    assert.equal(response.status, 400, JSON.stringify(body));
  }

  const badId = await ctx.request('GET', `/communities/${community.id}/announcements/not-a-uuid`, {
    token: admin.token,
  });
  assert.equal(badId.status, 400);
});

test('an announcement from another community is not reachable through this one', async () => {
  const first = await communityWithMember();
  const second = await communityWithMember();
  const { announcement } = (await publish(second.community, second.admin)).body.data;

  const response = await ctx.request(
    'PATCH',
    `/communities/${first.community.id}/announcements/${announcement.id}`,
    { token: first.admin.token, body: { title: 'Cross-community edit' } },
  );

  assert.equal(response.status, 404);
});

test('the dashboard feed lists recent announcements across my communities', async () => {
  const first = await communityWithMember();
  const second = await ctx.createTestCommunity(first.admin);
  await ctx.addActiveMember(second.id, first.member, first.admin.id);

  await publish(first.community, first.admin, { title: 'From the first' });
  await publish(second, first.admin, { title: 'From the second' });

  const response = await ctx.request('GET', '/announcements/me?limit=5', { token: first.member.token });

  assert.equal(response.status, 200);
  const titles = response.body.data.announcements.map((item) => item.title);
  assert.deepEqual(titles.sort(), ['From the first', 'From the second']);
  assert.ok(response.body.data.announcements.every((item) => item.community && item.community.name));
});
