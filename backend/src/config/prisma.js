const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the app (recommended by Prisma docs)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
