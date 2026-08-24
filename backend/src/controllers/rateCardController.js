const prisma = require('../config/prisma');

async function listRateCards(req, res) {
  const rateCards = await prisma.rateCard.findMany({
    include: { zoneFrom: true, zoneTo: true },
    orderBy: [{ orderType: 'asc' }, { zoneRelation: 'asc' }],
  });
  res.json({ rateCards });
}

// Creates/updates the default rate card for an (orderType, zoneRelation) pair,
// or a specific zone-pair override if zoneFromId/zoneToId are supplied.
async function upsertRateCard(req, res) {
  const { orderType, zoneRelation, zoneFromId, zoneToId, baseCharge, perKgRate } = req.body;

  if (!orderType || !zoneRelation || baseCharge == null || perKgRate == null) {
    return res.status(400).json({
      error: 'orderType, zoneRelation, baseCharge and perKgRate are required',
    });
  }

  const rateCard = await prisma.rateCard.upsert({
    where: {
      orderType_zoneRelation_zoneFromId_zoneToId: {
        orderType,
        zoneRelation,
        zoneFromId: zoneFromId || null,
        zoneToId: zoneToId || null,
      },
    },
    update: { baseCharge, perKgRate },
    create: {
      orderType,
      zoneRelation,
      zoneFromId: zoneFromId || null,
      zoneToId: zoneToId || null,
      baseCharge,
      perKgRate,
    },
  });

  res.status(201).json({ rateCard });
}

async function deleteRateCard(req, res) {
  const { id } = req.params;
  await prisma.rateCard.delete({ where: { id } });
  res.status(204).send();
}

async function listCodConfigs(req, res) {
  const codConfigs = await prisma.codConfig.findMany();
  res.json({ codConfigs });
}

async function upsertCodConfig(req, res) {
  const { orderType, surchargeType, value } = req.body;
  if (!orderType || !surchargeType || value == null) {
    return res.status(400).json({ error: 'orderType, surchargeType and value are required' });
  }

  const codConfig = await prisma.codConfig.upsert({
    where: { orderType },
    update: { surchargeType, value },
    create: { orderType, surchargeType, value },
  });

  res.status(201).json({ codConfig });
}

module.exports = {
  listRateCards,
  upsertRateCard,
  deleteRateCard,
  listCodConfigs,
  upsertCodConfig,
};
