const prisma = require('../config/prisma');

const VOLUMETRIC_DIVISOR = 5000;

/**
 * Volumetric weight (kg) = (L x B x H in cm) / 5000
 */
function calculateVolumetricWeight(lengthCm, breadthCm, heightCm) {
  return (lengthCm * breadthCm * heightCm) / VOLUMETRIC_DIVISOR;
}

/**
 * Billing is always on the higher of actual vs volumetric weight.
 */
function calculateChargeableWeight(actualWeightKg, volumetricWeightKg) {
  return Math.max(actualWeightKg, volumetricWeightKg);
}

function determineZoneRelation(pickupZoneId, dropZoneId) {
  return pickupZoneId === dropZoneId ? 'INTRA' : 'INTER';
}

/**
 * Looks up the applicable rate card. Tries the most specific match first
 * (exact zone-pair override), then falls back to the default card for the
 * given orderType + zoneRelation. Throws if admin hasn't configured one -
 * nothing is hardcoded, so an order simply cannot be priced until admin sets it up.
 */
async function getRateCard({ orderType, zoneRelation, pickupZoneId, dropZoneId }) {
  const specific = await prisma.rateCard.findFirst({
    where: {
      orderType,
      zoneRelation,
      zoneFromId: pickupZoneId,
      zoneToId: dropZoneId,
    },
  });
  if (specific) return specific;

  const fallback = await prisma.rateCard.findFirst({
    where: {
      orderType,
      zoneRelation,
      zoneFromId: null,
      zoneToId: null,
    },
  });

  if (!fallback) {
    throw new Error(
      `No rate card configured for orderType=${orderType}, zoneRelation=${zoneRelation}. Ask admin to configure one.`
    );
  }
  return fallback;
}

function calculateBaseCharge(rateCard, chargeableWeightKg) {
  return rateCard.baseCharge + rateCard.perKgRate * chargeableWeightKg;
}

/**
 * COD surcharge is admin-configurable per order type, as a flat amount or a
 * percentage of the base charge. Returns 0 for prepaid orders.
 */
async function calculateCodSurcharge({ paymentType, orderType, baseCharge }) {
  if (paymentType !== 'COD') return 0;

  const config = await prisma.codConfig.findUnique({ where: { orderType } });
  if (!config) return 0; // no surcharge configured yet - do not invent one

  if (config.surchargeType === 'FLAT') return config.value;
  return +(baseCharge * (config.value / 100)).toFixed(2);
}

/**
 * Full pricing pipeline used by the order controller.
 * Looks up zones from the given areas, computes weights, resolves the
 * rate card, and returns every intermediate figure so it can be persisted
 * transparently on the Order row (useful for the "show charge before
 * confirmation" requirement, and for auditing later).
 */
async function priceOrder({
  pickupAreaId,
  dropAreaId,
  lengthCm,
  breadthCm,
  heightCm,
  actualWeightKg,
  orderType,
  paymentType,
}) {
  const [pickupArea, dropArea] = await Promise.all([
    prisma.area.findUnique({ where: { id: pickupAreaId }, include: { zone: true } }),
    prisma.area.findUnique({ where: { id: dropAreaId }, include: { zone: true } }),
  ]);

  if (!pickupArea) throw new Error('Pickup area not found / not mapped to a zone');
  if (!dropArea) throw new Error('Drop area not found / not mapped to a zone');

  const volumetricWeightKg = calculateVolumetricWeight(lengthCm, breadthCm, heightCm);
  const chargeableWeightKg = calculateChargeableWeight(actualWeightKg, volumetricWeightKg);
  const zoneRelation = determineZoneRelation(pickupArea.zoneId, dropArea.zoneId);

  const rateCard = await getRateCard({
    orderType,
    zoneRelation,
    pickupZoneId: pickupArea.zoneId,
    dropZoneId: dropArea.zoneId,
  });

  const baseCharge = +calculateBaseCharge(rateCard, chargeableWeightKg).toFixed(2);
  const codSurcharge = +(await calculateCodSurcharge({ paymentType, orderType, baseCharge })).toFixed(2);
  const totalCharge = +(baseCharge + codSurcharge).toFixed(2);

  return {
    pickupZoneId: pickupArea.zoneId,
    dropZoneId: dropArea.zoneId,
    volumetricWeightKg: +volumetricWeightKg.toFixed(3),
    chargeableWeightKg: +chargeableWeightKg.toFixed(3),
    zoneRelation,
    baseCharge,
    codSurcharge,
    totalCharge,
    rateCardId: rateCard.id,
  };
}

module.exports = {
  calculateVolumetricWeight,
  calculateChargeableWeight,
  determineZoneRelation,
  getRateCard,
  calculateBaseCharge,
  calculateCodSurcharge,
  priceOrder,
};
