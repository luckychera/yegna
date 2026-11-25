const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { listMine, verify, regenerate } = require('./membership-card.controller');

const router = express.Router();

router.get('/me', authenticate, listMine);
router.post('/:membershipId/regenerate', authenticate, regenerate);

// Public: scanned from a card's QR code by someone who may not have an account.
router.get('/verify/:code', verify);

module.exports = router;
