const jwt = require('jsonwebtoken');

const env = require('../../config/env');

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

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};

