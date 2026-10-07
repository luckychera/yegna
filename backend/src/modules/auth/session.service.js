const crypto = require('node:crypto');

const { pool } = require('../../config/database');
const { generateAccessToken } = require('./token.service');

const REFRESH_TOKEN_EXPIRES_DAYS = 30;

function createSessionError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('base64url');
}

async function createAuthSession({ userId, ipAddress, userAgent }) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  const result = await pool.query(
    `
      INSERT INTO auth_sessions (
        user_id,
        token_hash,
        expires_at,
        ip_address,
        user_agent
      )
      VALUES (
        $1,
        $2,
        NOW() + ($3::INTEGER * INTERVAL '1 day'),
        $4,
        $5
      )
      RETURNING id, expires_at;
    `,
    [userId, tokenHash, REFRESH_TOKEN_EXPIRES_DAYS, ipAddress || null, userAgent || null],
  );

  return {
    sessionId: result.rows[0].id,
    refreshToken,
    refreshTokenExpiresAt: result.rows[0].expires_at,
  };
}

async function rotateRefreshToken({ refreshToken, ipAddress, userAgent }) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw createSessionError('A refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const client = await pool.connect();

  let transactionOpen = false;
  let outcome;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const result = await client.query(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.expires_at,
          s.revoked_at,
          u.email,
          u.phone,
          u.status
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
        FOR UPDATE OF s;
      `,
      [tokenHash],
    );

    const session = result.rows[0];

    if (!session) {
      throw createSessionError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (session.revoked_at) {
      // A previously rotated token was reused.
      // Revoke all remaining active sessions for this user.
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
            AND revoked_at IS NULL;
        `,
        [session.user_id],
      );

      await client.query('COMMIT');
      transactionOpen = false;

      outcome = {
        error: createSessionError(
          'Refresh token reuse detected. Please sign in again.',
          401,
          'REFRESH_TOKEN_REUSE_DETECTED',
        ),
      };
    } else if (new Date(session.expires_at).getTime() <= Date.now()) {
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = NOW(),
              updated_at = NOW()
          WHERE id = $1;
        `,
        [session.session_id],
      );

      await client.query('COMMIT');
      transactionOpen = false;

      outcome = {
        error: createSessionError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN'),
      };
    } else if (session.status !== 'active') {
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
            AND revoked_at IS NULL;
        `,
        [session.user_id],
      );

      await client.query('COMMIT');
      transactionOpen = false;

      outcome = {
        error: createSessionError('Account is not active', 403, 'ACCOUNT_NOT_ACTIVE'),
      };
    } else {
      const newRefreshToken = generateRefreshToken();
      const newTokenHash = hashRefreshToken(newRefreshToken);

      const newSessionResult = await client.query(
        `
          INSERT INTO auth_sessions (
            user_id,
            token_hash,
            expires_at,
            ip_address,
            user_agent
          )
          VALUES (
            $1,
            $2,
            NOW() + ($3::INTEGER * INTERVAL '1 day'),
            $4,
            $5
          )
          RETURNING id, expires_at;
        `,
        [
          session.user_id,
          newTokenHash,
          REFRESH_TOKEN_EXPIRES_DAYS,
          ipAddress || null,
          userAgent || null,
        ],
      );

      const newSession = newSessionResult.rows[0];

      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = NOW(),
              replaced_by_session_id = $2,
              updated_at = NOW()
          WHERE id = $1;
        `,
        [session.session_id, newSession.id],
      );

      await client.query('COMMIT');
      transactionOpen = false;

      outcome = {
        data: {
          user: {
            id: session.user_id,
            email: session.email,
            phone: session.phone,
            status: session.status,
          },
          accessToken: generateAccessToken({ id: session.user_id }),
          refreshToken: newRefreshToken,
          refreshTokenExpiresAt: newSession.expires_at,
        },
      };
    }
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK').catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }

  if (outcome.error) {
    throw outcome.error;
  }

  return outcome.data;
}

async function revokeAuthSession({ refreshToken, userId }) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw createSessionError('A refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  const result = await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(),
          updated_at = NOW()
      WHERE token_hash = $1
        AND user_id = $2
        AND revoked_at IS NULL
      RETURNING id;
    `,
    [hashRefreshToken(refreshToken), userId],
  );

  return {
    revoked: result.rowCount > 0,
  };
}

async function revokeAllUserSessions(userId) {
  const result = await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId],
  );

  return {
    revokedCount: result.rowCount,
  };
}

module.exports = {
  createAuthSession,
  rotateRefreshToken,
  revokeAuthSession,
  revokeAllUserSessions,
};
