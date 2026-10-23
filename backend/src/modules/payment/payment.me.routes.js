const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { listMyPaymentsController } = require('./payment.controller');

const router = express.Router();

// A user's own payments across communities. No community permission is required
// because the query is scoped to the authenticated user. Payment lifecycle
// operations (process/success/fail/cancel) are intentionally not exposed here.
router.get('/me', authenticate, listMyPaymentsController);

module.exports = router;
