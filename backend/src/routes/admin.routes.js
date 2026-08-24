const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.post('/admin/users', requireAuth, requireRole('ADMIN'), adminController.createUser);
router.get('/admin/users', requireAuth, requireRole('ADMIN'), adminController.listUsers);

module.exports = router;
