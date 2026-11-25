const bcrypt = require('bcryptjs');

const env = require('../../config/env');

const { generateAccessToken } = require('./token.service');
const { createAuthSession } = require('./session.service');
const { pool } = require('../../config/database');
const { verifyFaydaIdentity } = require('../identity/fayda.service');

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

async function registerUser({
  faydaIdentifier,
  faydaIdentifierType,
  email,
  phone,
  password,
  ipAddress,
  userAgent,
  firstName,
  middleName,
  lastName,
  displayName,
  preferredLanguage,
  timezone,
}) {
  const faydaVerification = await verifyFaydaIdentity({
    identifier: faydaIdentifier,
    identifierType: faydaIdentifierType,
  });

  if (!faydaVerification.verified) {
    const error = new Error('Fayda identity could not be verified');

    error.statusCode = 401;
    error.code = 'FAYDA_VERIFICATION_FAILED';

    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      `
        SELECT id
        FROM users
        WHERE deleted_at IS NULL
          AND (
            ($1::VARCHAR IS NOT NULL AND LOWER(email) = LOWER($1))
            OR
            ($2::VARCHAR IS NOT NULL AND phone = $2)
          )
        LIMIT 1;
      `,
      [email || null, phone || null],
    );

    if (existingUser.rows.length > 0) {
      const error = new Error('An account with those credentials already exists');

      error.statusCode = 409;
      error.code = 'ACCOUNT_ALREADY_EXISTS';

      throw error;
    }

    const passwordHash = await hashPassword(password);

    const userResult = await client.query(
      `
        INSERT INTO users (
          email,
          phone,
          password_hash
        )
        VALUES ($1, $2, $3)
        RETURNING id, email, phone, status, created_at;
      `,
      [email || null, phone || null, passwordHash],
    );

    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO user_profiles (
          user_id,
          first_name,
          middle_name,
          last_name,
          display_name,
          preferred_language,
          timezone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        user.id,
        firstName,
        middleName || null,
        lastName,
        displayName || null,
        preferredLanguage || 'en',
        timezone || 'Africa/Addis_Ababa',
      ],
    );

    await client.query(
      `
        INSERT INTO identities (
          user_id,
          provider,
          provider_subject,
          verification_status,
          verified_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, NOW(), $5::JSONB);
      `,
      [
        user.id,
        'fayda',
        faydaVerification.providerSubject,
        'verified',
        JSON.stringify({
          identifier_type: faydaVerification.identifierType,
          verification_mode: env.faydaMode,
        }),
      ],
    );

    await client.query('COMMIT');

    const session = await createAuthSession({
      userId: user.id,
      ipAddress,
      userAgent,
    });

    const accessToken = generateAccessToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      const conflictError = new Error('An account with those credentials already exists');

      conflictError.statusCode = 409;
      conflictError.code = 'ACCOUNT_ALREADY_EXISTS';

      throw conflictError;
    }

    throw error;
  } finally {
    client.release();
  }
}

async function loginUser({ email, phone, password, ipAddress, userAgent }) {
  const identifier = email || phone;

  const result = await pool.query(
    `
      SELECT
        id,
        email,
        phone,
        password_hash,
        status,
        created_at
      FROM users
      WHERE deleted_at IS NULL
        AND (
          LOWER(email) = LOWER($1::text)
          OR phone = $1::text
        )
      LIMIT 1;
    `,
    [identifier],
  );

  const user = result.rows[0];

  if (!user) {
    const error = new Error('Invalid email/phone or password');

    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';

    throw error;
  }

  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    const error = new Error('Invalid email/phone or password');

    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';

    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error('Account is not active');

    error.statusCode = 403;
    error.code = 'ACCOUNT_NOT_ACTIVE';

    throw error;
  }

  await pool.query(
    `
      UPDATE users
      SET last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [user.id],
  );

  const session = await createAuthSession({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  const accessToken = generateAccessToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.created_at,
    },
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  };
}

async function changePassword({ userId, currentPassword, newPassword }) {
  const result = await pool.query(
    `
      SELECT id, password_hash, status
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const error = new Error('User account not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = result.rows[0];

  if (user.status !== 'active') {
    const error = new Error('Account is not active');
    error.statusCode = 403;
    error.code = 'ACCOUNT_NOT_ACTIVE';
    throw error;
  }

  const currentPasswordMatches = await comparePassword(currentPassword, user.password_hash);

  if (!currentPasswordMatches) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 401;
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  const newPasswordMatches = await comparePassword(newPassword, user.password_hash);

  if (newPasswordMatches) {
    const error = new Error('New password must be different from the current password');
    error.statusCode = 400;
    error.code = 'PASSWORD_REUSE';
    throw error;
  }

  const newPasswordHash = await hashPassword(newPassword);

  await pool.query(
    `
      UPDATE users
      SET password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [newPasswordHash, userId],
  );

  return {
    changed: true,
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  registerUser,
  loginUser,
  changePassword,
};
