const jwt = require('jsonwebtoken');

const env = require('../../config/env');

// `sid` ties the access token to the refresh session it was issued for, so the
// API can tell which of a user's sessions is the current one.
function generateAccessToken(user, sessionId = null) {
  return jwt.sign(
    {
      sub: user.id,
      ...(sessionId ? { sid: sessionId } : {}),
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

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};
