const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.post('/orders/quote', requireAuth, requireRole('CUSTOMER', 'ADMIN'), orderController.quoteOrder);
router.post('/orders', requireAuth, requireRole('CUSTOMER', 'ADMIN'), orderController.createOrder);
router.get('/orders', requireAuth, orderController.listOrders);
router.get('/orders/:id', requireAuth, orderController.getOrder);

router.patch('/orders/:id/status', requireAuth, requireRole('AGENT', 'ADMIN'), orderController.updateStatus);
router.post('/orders/:id/reschedule', requireAuth, requireRole('CUSTOMER', 'ADMIN'), orderController.rescheduleOrder);
router.patch('/orders/:id/assign', requireAuth, requireRole('ADMIN'), orderController.manualAssign);

module.exports = router;
