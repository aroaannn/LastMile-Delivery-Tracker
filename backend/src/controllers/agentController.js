const prisma = require('../config/prisma');

// PATCH /agents/me/availability - agent toggles themself available/unavailable
// (e.g. going off shift). Auto-assignment only considers isAvailable=true agents.
async function setAvailability(req, res) {
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ error: 'isAvailable must be a boolean' });
  }

  const agent = await prisma.user.update({
    where: { id: req.user.id },
    data: { isAvailable },
  });

  res.json({ agent: { id: agent.id, isAvailable: agent.isAvailable } });
}

// GET /agents - admin: list all delivery agents with availability + zone
async function listAgents(req, res) {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT' },
    include: { homeZone: true },
  });
  res.json({ agents });
}

module.exports = { setAvailability, listAgents };
