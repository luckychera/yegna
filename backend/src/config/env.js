const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',

  faydaMode: process.env.FAYDA_MODE || 'mock',

  chapaMode: process.env.CHAPA_MODE || 'test',
  chapaSecretKey: process.env.CHAPA_SECRET_KEY || '',

  aiApiKey: process.env.AI_API_KEY || '',

  smsApiKey: process.env.SMS_API_KEY || '',
  emailApiKey: process.env.EMAIL_API_KEY || '',
};

module.exports = env;
