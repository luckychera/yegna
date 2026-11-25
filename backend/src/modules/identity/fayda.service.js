const env = require('../../config/env');

const mockFaydaProvider = require('./providers/mock-fayda.provider');

async function verifyFaydaIdentity({
  identifier,
  identifierType,
}) {
  if (env.faydaMode === 'mock') {
    return mockFaydaProvider.verifyIdentity({
      identifier,
      identifierType,
    });
  }

  throw new Error('Real Fayda provider is not configured');
}

module.exports = {
  verifyFaydaIdentity,
};
