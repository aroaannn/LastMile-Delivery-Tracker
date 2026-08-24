const prisma = require('../config/prisma');
const { priceOrder } = require('../utils/rateEngine');
const { findBestAgent, assignAgentToOrder, releaseAgent } = require('../utils/assignment');
const { sendStatusEmail } = require('../utils/notify');

const VALID_TRANSITIONS = {
  CREATED: ['ASSIGNED', 'FAILED'],
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  FAILED: ['RESCHEDULED'],
  RESCHEDULED: ['ASSIGNED'],
  DELIVERED: [],
};

function extractOrderInput(body) {
  const {
    pickupAddress,
    pickupAreaId,
    dropAddress,
    dropAreaId,
    lengthCm,
    breadthCm,
    heightCm,
    actualWeightKg,
    orderType,
    paymentType,
  } = body;

  const missing = [
    'pickupAddress',
    'pickupAreaId',
    'dropAddress',
    'dropAreaId',
    'lengthCm',
    'breadthCm',
    'heightCm',
    'actualWeightKg',
    'orderType',
    'paymentType',
  ].filter((f) => body[f] === undefined || body[f] === null || body[f] === '');

  if (missing.length) {
    const err = new Error(`Missing required field(s): ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (!['B2B', 'B2C'].includes(orderType)) {
    const err = new Error('orderType must be B2B or B2C');
    err.status = 400;
    throw err;
  }
  if (!['PREPAID', 'COD'].includes(paymentType)) {
    const err = new Error('paymentType must be PREPAID or COD');
    err.status = 400;
    throw err;
  }

  return {
    pickupAddress,
    pickupAreaId,
    dropAddress,
    dropAreaId,
    lengthCm: Number(lengthCm),
    breadthCm: Number(breadthCm),
    heightCm: Number(heightCm),
    actualWeightKg: Number(actualWeightKg),
    orderType,
    paymentType,
  };
}

// POST /orders/quote - price preview shown to the customer before they confirm.
// Does not touch the database.
async function quoteOrder(req, res) {
  try {
    const input = extractOrderInput(req.body);
    const quote = await priceOrder(input);
    res.json({ quote });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}

// POST /orders - creates the order after the customer has confirmed the quote.
// Admins can create on behalf of a customer by passing customerId.
async function createOrder(req, res) {
  try {
    const input = extractOrderInput(req.body);

    let customerId = req.user.id;
    if (req.user.role === 'ADMIN' && req.body.customerId) {
      customerId = req.body.customerId;
    } else if (req.user.role !== 'CUSTOMER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only customers or admins can create orders' });
    }

    const pricing = await priceOrder(input);

    const order = await prisma.order.create({
      data: {
        customerId,
        pickupAddress: input.pickupAddress,
        pickupAreaId: input.pickupAreaId,
        pickupZoneId: pricing.pickupZoneId,
        dropAddress: input.dropAddress,
        dropAreaId: input.dropAreaId,
        dropZoneId: pricing.dropZoneId,
        lengthCm: input.lengthCm,
        breadthCm: input.breadthCm,
        heightCm: input.heightCm,
        actualWeightKg: input.actualWeightKg,
        volumetricWeightKg: pricing.volumetricWeightKg,
        chargeableWeightKg: pricing.chargeableWeightKg,
        orderType: input.orderType,
        paymentType: input.paymentType,
        zoneRelation: pricing.zoneRelation,
        baseCharge: pricing.baseCharge,
        codSurcharge: pricing.codSurcharge,
        totalCharge: pricing.totalCharge,
        status: 'CREATED',
      },
      include: { customer: true },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'CREATED',
        actorId: req.user.id,
        actorRole: req.user.role,
        note: req.user.role === 'ADMIN' ? 'Order created by admin on behalf of customer' : 'Order created',
      },
    });

    await sendStatusEmail(order, order.customer.email, 'CREATED');

    // Attempt auto-assignment immediately; if no agent is free the order
    // simply stays CREATED until admin assigns manually or one frees up.
    const agent = await findBestAgent({ pickupZoneId: order.pickupZoneId, dropZoneId: order.dropZoneId });
    if (agent) {
      await assignAgentToOrder({
        orderId: order.id,
        agentId: agent.id,
        actorRole: 'ADMIN',
        note: 'Auto-assigned nearest available agent',
      });
      await sendStatusEmail(order, order.customer.email, 'ASSIGNED');
    }

    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { agent: true, customer: true, pickupZone: true, dropZone: true },
    });

    res.status(201).json({ order: finalOrder });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}

// GET /orders/:id - full order + immutable tracking timeline
async function getOrder(req, res) {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      agent: true,
      pickupZone: true,
      dropZone: true,
      pickupArea: true,
      dropArea: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isOwnerCustomer = req.user.role === 'CUSTOMER' && order.customerId === req.user.id;
  const isOwnerAgent = req.user.role === 'AGENT' && order.agentId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwnerCustomer && !isOwnerAgent && !isAdmin) {
    return res.status(403).json({ error: 'Not authorized to view this order' });
  }

  res.json({ order });
}

// GET /orders - list, scoped by role, with optional filters for admin
async function listOrders(req, res) {
  const { status, zoneId, agentId } = req.query;
  const where = {};

  if (req.user.role === 'CUSTOMER') where.customerId = req.user.id;
  if (req.user.role === 'AGENT') where.agentId = req.user.id;

  if (status) where.status = status;
  if (zoneId) where.pickupZoneId = zoneId;
  if (agentId && req.user.role === 'ADMIN') where.agentId = agentId;

  const orders = await prisma.order.findMany({
    where,
    include: { customer: true, agent: true, pickupZone: true, dropZone: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ orders });
}

// PATCH /orders/:id/status - agent updates delivery progress, or admin overrides.
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status, note, failureReason } = req.body;

  const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isOwnerAgent = req.user.role === 'AGENT' && order.agentId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwnerAgent && !isAdmin) {
    return res.status(403).json({ error: 'Only the assigned agent or an admin can update status' });
  }

  // Admins can override to any status; agents must follow the defined lifecycle.
  if (!isAdmin) {
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid transition from ${order.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      });
    }
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      failureReason: status === 'FAILED' ? failureReason || null : order.failureReason,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      status,
      actorId: req.user.id,
      actorRole: req.user.role,
      note: note || (isAdmin && !isOwnerAgent ? 'Status overridden by admin' : null),
    },
  });

  // Delivered or failed both free up the agent for new assignments.
  if (status === 'DELIVERED' || status === 'FAILED') {
    await releaseAgent(order.agentId);
  }

  await sendStatusEmail(updated, order.customer.email, status);

  res.json({ order: updated });
}

// POST /orders/:id/reschedule - customer reschedules a failed delivery;
// system re-runs auto-assignment for the new attempt.
async function rescheduleOrder(req, res) {
  const { id } = req.params;
  const { newDate } = req.body;
  if (!newDate) return res.status(400).json({ error: 'newDate is required' });

  const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isOwner = req.user.role === 'CUSTOMER' && order.customerId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Not authorized to reschedule this order' });
  }
  if (order.status !== 'FAILED') {
    return res.status(400).json({ error: 'Only a FAILED order can be rescheduled' });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'RESCHEDULED', rescheduledDate: new Date(newDate), agentId: null },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      status: 'RESCHEDULED',
      actorId: req.user.id,
      actorRole: req.user.role,
      note: `Rescheduled for ${new Date(newDate).toISOString()}`,
    },
  });

  await sendStatusEmail(updated, order.customer.email, 'RESCHEDULED');

  // Re-run auto-assignment for the new attempt.
  const agent = await findBestAgent({ pickupZoneId: order.pickupZoneId, dropZoneId: order.dropZoneId });
  if (agent) {
    await assignAgentToOrder({
      orderId: id,
      agentId: agent.id,
      actorRole: 'ADMIN',
      note: 'Auto-assigned for rescheduled attempt',
    });
    await sendStatusEmail(updated, order.customer.email, 'ASSIGNED');
  }

  const finalOrder = await prisma.order.findUnique({ where: { id }, include: { agent: true } });
  res.json({ order: finalOrder });
}

// PATCH /orders/:id/assign - admin manually assigns/reassigns an agent.
async function manualAssign(req, res) {
  const { id } = req.params;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });

  const [order, agent] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { customer: true } }),
    prisma.user.findUnique({ where: { id: agentId } }),
  ]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!agent || agent.role !== 'AGENT') return res.status(400).json({ error: 'agentId must reference a delivery agent' });

  // Free the previous agent, if any, before assigning the new one.
  if (order.agentId && order.agentId !== agentId) {
    await releaseAgent(order.agentId);
  }

  await assignAgentToOrder({
    orderId: id,
    agentId,
    actorId: req.user.id,
    actorRole: req.user.role,
    note: 'Manually assigned by admin',
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { agent: true, customer: true } });
  await sendStatusEmail(updated, updated.customer.email, 'ASSIGNED');

  res.json({ order: updated });
}

module.exports = {
  quoteOrder,
  createOrder,
  getOrder,
  listOrders,
  updateStatus,
  rescheduleOrder,
  manualAssign,
};
