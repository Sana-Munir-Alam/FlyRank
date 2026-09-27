const express = require('express');

const authController = require('../modules/auth/authController');
const { requireAuth } = require('../middleware/auth');
const { requireCsrfToken } = require('../middleware/csrf');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', requireAuth, requireCsrfToken, authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;