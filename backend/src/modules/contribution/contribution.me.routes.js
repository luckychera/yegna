const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { listMine } = require('./contribution.controller');

const router = express.Router();

// A user's own contributions across communities. No community permission is
// required because the query is scoped to the authenticated user's memberships.
router.get('/me', authenticate, listMine);

module.exports = router;
