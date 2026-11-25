const env = require('../config/env');

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseOrigin(value) {
  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

/**
 * Whether a browser origin belongs to the Yegna web app. Configured origins
 * (CORS_ORIGINS / APP_BASE_URL) are always trusted; loopback origins are trusted
 * outside production so local development needs no configuration.
 */
function isTrustedAppOrigin(origin) {
  const url = parseOrigin(origin);

  if (!url) {
    return false;
  }

  if (env.corsOrigins.includes(url.origin)) {
    return true;
  }

  return !env.isProduction && LOOPBACK_HOSTS.has(url.hostname);
}

/** Absolute URLs the API may redirect a member's browser to (e.g. after payment). */
function isTrustedAppUrl(value) {
  const url = parseOrigin(value);

  return Boolean(url) && isTrustedAppOrigin(url.origin);
}

module.exports = {
  isTrustedAppOrigin,
  isTrustedAppUrl,
};
