const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

// POST /admin/users - admin creates AGENT or ADMIN accounts.
// (Customers self-register via /auth/register.)
async function createUser(req, res) {
  const { name, email, password, phone, role, homeZoneId } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (!['AGENT', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'role must be AGENT or ADMIN' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role, homeZoneId: homeZoneId || null },
  });

  const { passwordHash: _, ...safe } = user;
  res.status(201).json({ user: safe });
}

async function listUsers(req, res) {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, name: true, email: true, role: true, isAvailable: true, homeZoneId: true, createdAt: true },
  });
  res.json({ users });
}

module.exports = { createUser, listUsers };
