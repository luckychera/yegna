const express = require('express');

const { checkDatabaseConnection } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const database = await checkDatabaseConnection();

    res.status(200).json({
      success: true,
      service: 'yegna-api',
      status: 'healthy',
      database: 'connected',
      timestamp: database.now,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
