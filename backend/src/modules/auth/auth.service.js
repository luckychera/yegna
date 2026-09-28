const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const env = require('../../config/env');
const { pool } = require('../../config/database');
const { verifyFaydaIdentity } = require('../identity/fayda.service');

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

async function registerUser({
  faydaIdentifier,
  faydaIdentifierType,
  email,
  phone,
  password,
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

async function loginUser({ identifier, password }) {
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
          LOWER(email) = LOWER($1)
          OR phone = $1
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
      WHERE id = $1;
    `,
    [user.id],
  );

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
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  verifyAccessToken,
  registerUser,
  loginUser,
};
