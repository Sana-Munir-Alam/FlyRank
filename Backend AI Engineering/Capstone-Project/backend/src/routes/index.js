const express = require('express');
const pool = require('../config/database');
const authRoutes = require('./auth');
const widgets = require('./widgets');

const router = express.Router();

router.get('/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

router.use('/api/auth', authRoutes);
router.use('/api/widgets', widgets);

module.exports = router;