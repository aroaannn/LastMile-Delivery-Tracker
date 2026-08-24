const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@lastmile.test' },
    update: {},
    create: {
      name: 'Ops Admin',
      email: 'admin@lastmile.test',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const zoneNorth = await prisma.zone.upsert({
    where: { code: 'NORTH' },
    update: {},
    create: { name: 'North Zone', code: 'NORTH' },
  });
  const zoneSouth = await prisma.zone.upsert({
    where: { code: 'SOUTH' },
    update: {},
    create: { name: 'South Zone', code: 'SOUTH' },
  });

  const areaA = await prisma.area.upsert({
    where: { pincode: '110001' },
    update: {},
    create: { name: 'Connaught Place', pincode: '110001', zoneId: zoneNorth.id },
  });
  const areaB = await prisma.area.upsert({
    where: { pincode: '560001' },
    update: {},
    create: { name: 'MG Road', pincode: '560001', zoneId: zoneSouth.id },
  });

  await prisma.rateCard.upsert({
    where: {
      orderType_zoneRelation_zoneFromId_zoneToId: {
        orderType: 'B2C', zoneRelation: 'INTRA', zoneFromId: null, zoneToId: null,
      },
    },
    update: {},
    create: { orderType: 'B2C', zoneRelation: 'INTRA', baseCharge: 30, perKgRate: 10 },
  });
  await prisma.rateCard.upsert({
    where: {
      orderType_zoneRelation_zoneFromId_zoneToId: {
        orderType: 'B2C', zoneRelation: 'INTER', zoneFromId: null, zoneToId: null,
      },
    },
    update: {},
    create: { orderType: 'B2C', zoneRelation: 'INTER', baseCharge: 50, perKgRate: 15 },
  });
  await prisma.rateCard.upsert({
    where: {
      orderType_zoneRelation_zoneFromId_zoneToId: {
        orderType: 'B2B', zoneRelation: 'INTRA', zoneFromId: null, zoneToId: null,
      },
    },
    update: {},
    create: { orderType: 'B2B', zoneRelation: 'INTRA', baseCharge: 25, perKgRate: 8 },
  });
  await prisma.rateCard.upsert({
    where: {
      orderType_zoneRelation_zoneFromId_zoneToId: {
        orderType: 'B2B', zoneRelation: 'INTER', zoneFromId: null, zoneToId: null,
      },
    },
    update: {},
    create: { orderType: 'B2B', zoneRelation: 'INTER', baseCharge: 40, perKgRate: 12 },
  });

  await prisma.codConfig.upsert({
    where: { orderType: 'B2C' },
    update: {},
    create: { orderType: 'B2C', surchargeType: 'FLAT', value: 20 },
  });
  await prisma.codConfig.upsert({
    where: { orderType: 'B2B' },
    update: {},
    create: { orderType: 'B2B', surchargeType: 'PERCENT', value: 2 },
  });

  await prisma.user.upsert({
    where: { email: 'agent.north@lastmile.test' },
    update: {},
    create: {
      name: 'Agent North',
      email: 'agent.north@lastmile.test',
      passwordHash,
      role: 'AGENT',
      homeZoneId: zoneNorth.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'agent.south@lastmile.test' },
    update: {},
    create: {
      name: 'Agent South',
      email: 'agent.south@lastmile.test',
      passwordHash,
      role: 'AGENT',
      homeZoneId: zoneSouth.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@lastmile.test' },
    update: {},
    create: {
      name: 'Sample Customer',
      email: 'customer@lastmile.test',
      passwordHash,
      role: 'CUSTOMER',
    },
  });

  console.log('Seed complete. Sample login: admin@lastmile.test / password123 (all seeded users share this password).');
  console.log(`Sample areas: ${areaA.pincode} (North), ${areaB.pincode} (South)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
