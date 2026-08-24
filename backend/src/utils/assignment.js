const prisma = require('../config/prisma');

/**
 * Finds the "nearest available agent" for an order's pickup zone.
 *
 * Modelling note: without live GPS feeds, "nearest" is modelled at zone
 * granularity - an agent's homeZoneId is treated as their current
 * service area. Priority order:
 *   1. Available agent whose homeZone == pickup zone
 *   2. Available agent whose homeZone == drop zone (covers the other end)
 *   3. Any other available agent (system-wide fallback so orders aren't stuck)
 * If none are available, the order is left unassigned for admin to handle.
 */
async function findBestAgent({ pickupZoneId, dropZoneId }) {
  const inPickupZone = await prisma.user.findFirst({
    where: { role: 'AGENT', isAvailable: true, homeZoneId: pickupZoneId },
    orderBy: { createdAt: 'asc' },
  });
  if (inPickupZone) return inPickupZone;

  const inDropZone = await prisma.user.findFirst({
    where: { role: 'AGENT', isAvailable: true, homeZoneId: dropZoneId },
    orderBy: { createdAt: 'asc' },
  });
  if (inDropZone) return inDropZone;

  const anyAvailable = await prisma.user.findFirst({
    where: { role: 'AGENT', isAvailable: true },
    orderBy: { createdAt: 'asc' },
  });
  return anyAvailable || null;
}

/**
 * Assigns an agent to an order (auto or manual), marks the agent unavailable,
 * appends an ASSIGNED entry to the immutable status history, and returns the
 * updated order. Used by both the auto-assign path and manual admin assignment.
 */
async function assignAgentToOrder({ orderId, agentId, actorId, actorRole, note }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { agentId, status: 'ASSIGNED' },
    });

    await tx.user.update({
      where: { id: agentId },
      data: { isAvailable: false },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'ASSIGNED',
        actorId: actorId || null,
        actorRole: actorRole || null,
        note: note || 'Agent assigned',
      },
    });

    return order;
  });
}

/**
 * Frees up an agent (e.g. after delivery, failure, or reassignment) so they
 * re-enter the available pool for future auto-assignment.
 */
async function releaseAgent(agentId) {
  if (!agentId) return;
  await prisma.user.update({
    where: { id: agentId },
    data: { isAvailable: true },
  });
}

module.exports = { findBestAgent, assignAgentToOrder, releaseAgent };
