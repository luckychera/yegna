const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

if (isProduction && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

// Browser origins allowed to call the API and to receive payment redirects.
// Outside production, loopback origins (the Vite dev server) are also accepted;
// see utils/origins.js.
const corsOrigins = parseList(process.env.CORS_ORIGINS);
const appBaseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '') || null;

if (appBaseUrl && !corsOrigins.includes(appBaseUrl)) {
  corsOrigins.push(appBaseUrl);
}

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '330m',

  corsOrigins,
  appBaseUrl,
  // Number of reverse proxies in front of the API (needed for correct client IPs
  // in rate limiting and session records). 0 means the API is reached directly.
  trustProxy: parsePositiveInteger(process.env.TRUST_PROXY, 0),

  rateLimitWindowMs: parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 600),
  authRateLimitMax: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 20),

  faydaMode: process.env.FAYDA_MODE || 'mock',

  chapaMode: process.env.CHAPA_MODE || 'test',
  chapaSecretKey: process.env.CHAPA_SECRET_KEY || '',
  chapaBaseUrl: process.env.CHAPA_BASE_URL || 'https://api.chapa.co',
  chapaWebhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',

  aiApiKey: process.env.AI_API_KEY || '',

  smsApiKey: process.env.SMS_API_KEY || '',
  emailApiKey: process.env.EMAIL_API_KEY || '',
};

module.exports = env;
