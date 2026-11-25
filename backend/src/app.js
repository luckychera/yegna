const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes');
const notFound = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

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
