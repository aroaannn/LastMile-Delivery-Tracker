const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

// Zones are readable by any authenticated role (customers need them to place orders);
// writes are admin-only.
router.get('/zones', requireAuth, zoneController.listZones);
router.post('/zones', requireAuth, requireRole('ADMIN'), zoneController.createZone);
router.patch('/zones/:id', requireAuth, requireRole('ADMIN'), zoneController.updateZone);
router.delete('/zones/:id', requireAuth, requireRole('ADMIN'), zoneController.deleteZone);

router.get('/areas', requireAuth, zoneController.listAreas);
router.post('/areas', requireAuth, requireRole('ADMIN'), zoneController.createArea);
router.patch('/areas/:id', requireAuth, requireRole('ADMIN'), zoneController.updateArea);
router.delete('/areas/:id', requireAuth, requireRole('ADMIN'), zoneController.deleteArea);

module.exports = router;
