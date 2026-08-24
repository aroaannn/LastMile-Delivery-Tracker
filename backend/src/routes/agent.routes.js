const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

router.patch('/agents/me/availability', requireAuth, requireRole('AGENT'), agentController.setAvailability);
router.get('/agents', requireAuth, requireRole('ADMIN'), agentController.listAgents);

module.exports = router;
