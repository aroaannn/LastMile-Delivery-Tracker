const prisma = require('../config/prisma');

async function listZones(req, res) {
  const zones = await prisma.zone.findMany({ include: { areas: true } });
  res.json({ zones });
}

async function createZone(req, res) {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });

  const zone = await prisma.zone.create({ data: { name, code } });
  res.status(201).json({ zone });
}

async function updateZone(req, res) {
  const { id } = req.params;
  const { name, code } = req.body;
  const zone = await prisma.zone.update({ where: { id }, data: { name, code } });
  res.json({ zone });
}

async function deleteZone(req, res) {
  const { id } = req.params;
  await prisma.zone.delete({ where: { id } });
  res.status(204).send();
}

// Admin assigns an area (pincode/locality) to a zone - this mapping is what
// "zone detection" looks up at order-creation time.
async function createArea(req, res) {
  const { name, pincode, zoneId } = req.body;
  if (!name || !pincode || !zoneId) {
    return res.status(400).json({ error: 'name, pincode and zoneId are required' });
  }

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return res.status(404).json({ error: 'Zone not found' });

  const area = await prisma.area.create({ data: { name, pincode, zoneId } });
  res.status(201).json({ area });
}

async function listAreas(req, res) {
  const areas = await prisma.area.findMany({ include: { zone: true } });
  res.json({ areas });
}

async function updateArea(req, res) {
  const { id } = req.params;
  const { name, pincode, zoneId } = req.body;
  const area = await prisma.area.update({ where: { id }, data: { name, pincode, zoneId } });
  res.json({ area });
}

async function deleteArea(req, res) {
  const { id } = req.params;
  await prisma.area.delete({ where: { id } });
  res.status(204).send();
}

module.exports = {
  listZones,
  createZone,
  updateZone,
  deleteZone,
  createArea,
  listAreas,
  updateArea,
  deleteArea,
};
