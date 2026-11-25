const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');
const { isTrustedAppOrigin } = require('./utils/origins');

const app = express();

app.disable('x-powered-by');

if (env.trustProxy > 0) {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet());

app.use(
  cors({
    // Requests without an Origin header (server-to-server, curl, same-origin
    // navigations) are not subject to CORS; browsers must come from the web app.
    origin(origin, callback) {
      callback(null, !origin || isTrustedAppOrigin(origin));
    },
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

// Credential endpoints get a much smaller budget to slow down password guessing.
const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait a few minutes and try again.',
    },
  },
});

app.use(['/api/v1/auth/login', '/api/v1/auth/register'], authLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'yegna-api',
    version: '1.0.0',
    message: 'Yegna API is running',
  });
});

app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
