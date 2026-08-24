const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const rateCardController = require('../controllers/rateCardController');

router.get('/rate-cards', requireAuth, requireRole('ADMIN'), rateCardController.listRateCards);
router.post('/rate-cards', requireAuth, requireRole('ADMIN'), rateCardController.upsertRateCard);
router.delete('/rate-cards/:id', requireAuth, requireRole('ADMIN'), rateCardController.deleteRateCard);

router.get('/cod-config', requireAuth, requireRole('ADMIN'), rateCardController.listCodConfigs);
router.post('/cod-config', requireAuth, requireRole('ADMIN'), rateCardController.upsertCodConfig);

module.exports = router;
