const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

function getMe(user) {
  return ctx.request('GET', '/users/me', { token: user.token });
}

test('GET /users/me requires authentication', async () => {
  const response = await ctx.request('GET', '/users/me');

  assert.equal(response.status, 401);
});

test('GET /users/me rejects an invalid token', async () => {
  const response = await ctx.request('GET', '/users/me', { token: 'not.a.token' });

  assert.equal(response.status, 401);
});

test('GET /users/me returns account, profile and verified Fayda status', async () => {
  const user = await ctx.createUser({ firstName: 'Abebe', lastName: 'Kebede' });
  await ctx.createIdentity(user.id, { status: 'verified' });

  const response = await getMe(user);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const { data } = response.body;

  assert.equal(data.user.id, user.id);
  assert.equal(data.user.email, user.email);
  assert.equal(data.user.status, 'active');
  assert.ok(data.user.createdAt);

  assert.equal(data.profile.firstName, 'Abebe');
  assert.equal(data.profile.lastName, 'Kebede');
  assert.equal(data.profile.fullName, 'Abebe Kebede');
  assert.equal(data.profile.preferredLanguage, 'en');
  assert.equal(data.profile.timezone, 'Africa/Addis_Ababa');

  assert.deepEqual(Object.keys(data.identity).sort(), ['provider', 'verificationStatus', 'verifiedAt']);
  assert.equal(data.identity.provider, 'fayda');
  assert.equal(data.identity.verificationStatus, 'verified');
  assert.ok(data.identity.verifiedAt);
});

test('GET /users/me prefers display name for fullName', async () => {
  const user = await ctx.createUser({ firstName: 'Abebe', lastName: 'Kebede', displayName: 'Abebe K.' });

  const response = await getMe(user);

  assert.equal(response.body.data.profile.displayName, 'Abebe K.');
  assert.equal(response.body.data.profile.fullName, 'Abebe K.');
});

test('GET /users/me never exposes the Fayda ID, password hash, or internal fields', async () => {
  const user = await ctx.createUser();
  const secretFin = '987654321012';

  await ctx.createIdentity(user.id, { status: 'verified', subject: secretFin });
  await pool.query("UPDATE users SET password_hash = 'bcrypt-hash-should-never-leak' WHERE id = $1", [user.id]);

  const response = await getMe(user);

  assert.equal(response.status, 200);
  assert.ok(!response.text.includes(secretFin), 'Fayda ID must not be returned, even partially');
  assert.ok(!response.text.includes(secretFin.slice(-4)), 'last digits must not be returned');
  assert.doesNotMatch(response.text, /bcrypt-hash-should-never-leak|password|provider_subject|providerSubject|deleted_at/i);
});

test('GET /users/me reports the unverified states honestly', async () => {
  const noIdentity = await ctx.createUser();
  const pending = await ctx.createUser();
  const failed = await ctx.createUser();

  await ctx.createIdentity(pending.id, { status: 'pending' });
  await ctx.createIdentity(failed.id, { status: 'failed' });

  assert.equal((await getMe(noIdentity)).body.data.identity, null);

  const pendingBody = (await getMe(pending)).body.data.identity;
  const failedBody = (await getMe(failed)).body.data.identity;

  assert.equal(pendingBody.verificationStatus, 'pending');
  assert.equal(pendingBody.verifiedAt, null);
  assert.equal(failedBody.verificationStatus, 'failed');
});

test('GET /users/me returns a null profile for an account without a profile row', async () => {
  const user = await ctx.createUser({ withProfile: false });

  const response = await getMe(user);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile, null);
  assert.equal(response.body.data.user.id, user.id);
});

test('GET /users/me only ever returns the caller\'s own data', async () => {
  const alice = await ctx.createUser({ firstName: 'Alice', lastName: 'Alpha' });
  const bob = await ctx.createUser({ firstName: 'Bob', lastName: 'Beta' });

  const aliceResponse = await getMe(alice);
  const bobResponse = await getMe(bob);

  assert.equal(aliceResponse.body.data.user.id, alice.id);
  assert.equal(bobResponse.body.data.user.id, bob.id);
  assert.ok(!aliceResponse.text.includes('Bob'));
  assert.ok(!bobResponse.text.includes('Alice'));
});

test('GET /users/me returns 404 for a deleted account with a still-valid token', async () => {
  const user = await ctx.createUser();

  await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [user.id]);

  const response = await getMe(user);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'USER_NOT_FOUND');
});
