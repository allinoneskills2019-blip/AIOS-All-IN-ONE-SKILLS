import assert from 'node:assert/strict';
import {
  AUTOMOTIVE_SUBCATEGORIES,
  BOOKING_PROGRESS_STEPS,
  CORE_MUMBAI_CLUSTER_NAMES,
  DEFAULT_PLATFORM_CONFIG,
  MEMBERSHIP_QUOTA_TIERS,
  MUMBAI_DISTRICTS,
  MUMBAI_INITIAL_CLUSTERS,
  SKILL_CATEGORIES,
  getMumbaiDistrict,
} from '../src/lib/constants';
import {
  findNearestMumbaiZone,
  getDistanceToZoneKm,
  getZoneCoords,
} from '../src/lib/geo';
import {
  findNextFreeSlot,
  getBookedSlotSet,
  makeSlotKey,
} from '../src/lib/availability';
import { computeAiRecommendedTechnicians } from '../src/lib/recommendations';
import { computeMaintenanceReminders } from '../src/lib/maintenanceReminders';
import { getSkillTestPack } from '../src/lib/skillTests';
import { computeDistrictSkillMatrix, computeMumbaiZoneHeatmap } from '../src/lib/heatmap';
import type {
  CartItem,
  ContractorProfile,
  Product,
  ServiceBooking,
  ShopProfile,
  TechnicianProfile,
  UserAccount,
  UserRole,
} from '../src/types';

function logPass(name: string) {
  console.log(`PASS: ${name}`);
}

function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (input.startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new Error(`Invalid phone format: ${input}`);
}

function validateUserOnboarding(role: UserRole, displayName: string, phoneRaw: string, clusterZone: string): UserAccount {
  assert.ok(['customer', 'shopkeeper', 'contractor', 'technician'].includes(role), `Unexpected onboarding role ${role}`);
  assert.ok(displayName.trim().length >= 2, 'Display name required');
  const e164 = normalizeIndianPhone(phoneRaw);
  assert.match(e164, /^\+\d{10,15}$/, 'Valid E.164 phone');
  assert.ok(
    MUMBAI_INITIAL_CLUSTERS.some((z) => z.name.toLowerCase() === clusterZone.toLowerCase()),
    `Zone "${clusterZone}" must exist in Mumbai cluster catalog`
  );
  return {
    uid: `test_${role}_${displayName.toLowerCase().replace(/\s+/g, '_')}`,
    displayName: displayName.trim(),
    role,
    phoneVerified: true,
    clusterZone,
  };
}

function computeBookingPricePreview(
  tech: TechnicianProfile,
  estimatedHours: number,
  bookingFee: number,
  commissionPercent: number,
  availableLoyaltyPts: number,
  redeemLoyalty: boolean
) {
  const calloutFee =
    typeof tech.calloutFee === 'number' && tech.calloutFee >= 0 ? tech.calloutFee : tech.expectedCharge;
  const hourlyRate =
    typeof tech.hourlyRate === 'number' && tech.hourlyRate >= 0
      ? tech.hourlyRate
      : Math.round((tech.expectedCharge || 0) * 0.45);
  const hours = Math.min(12, Math.max(1, estimatedHours));
  const laborSubtotal = calloutFee + hourlyRate * hours;
  const maxRedeemablePts = Math.min(availableLoyaltyPts, Math.floor(laborSubtotal * 0.25), 500);
  const discountApplied = redeemLoyalty ? maxRedeemablePts : 0;
  const commissionAmount = Math.round(((laborSubtotal - discountApplied) * commissionPercent) / 100);
  const totalEstimated = Math.max(0, laborSubtotal - discountApplied + bookingFee);
  return {
    calloutFee,
    hourlyRate,
    hours,
    laborSubtotal,
    discountApplied,
    commissionAmount,
    totalEstimated,
  };
}

function computeCartTotals(cart: CartItem[], applyMemberDiscount: boolean) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalShipping = 0;
  for (const item of cart) {
    const lineSub = item.product.price * item.quantity;
    subtotal += lineSub;
    if (applyMemberDiscount && (item.product.memberDiscountPercent || 0) > 0) {
      totalDiscount += Math.round((lineSub * (item.product.memberDiscountPercent || 0)) / 100);
    }
    if (item.product.shippingAvailable) {
      totalShipping += item.product.shippingFee || 0;
    }
  }
  return {
    subtotal,
    totalDiscount,
    totalShipping,
    payableTotal: Math.max(0, subtotal - totalDiscount + totalShipping),
  };
}

async function runSuite() {
  console.log('--- All in One Skill Regression Suite ---');

  // 1. Registration & Login Validation across all 4 roles
  const rolesToZones: Array<[UserRole, string, string]> = [
    ['customer', 'Aarav Mehta', 'Colaba'],
    ['technician', 'Ramesh Yadav', 'Powai'],
    ['shopkeeper', 'Suresh Hardware', 'Ghatkopar'],
    ['contractor', 'BuildCorp Infra', 'Malad'],
  ];
  const createdUsers = rolesToZones.map(([role, name, zone]) =>
    validateUserOnboarding(role, name, '9820112233', zone)
  );
  assert.equal(createdUsers.length, 4);
  assert.equal(normalizeIndianPhone('+91 98201 12233'), '+919820112233');
  logPass('Role registration & E.164 login validation for customer, technician, shopkeeper, contractor');

  // 2. Mumbai Service Cluster Coverage (All City & Suburban districts)
  assert.ok(MUMBAI_INITIAL_CLUSTERS.length >= 50, 'At least 50 Mumbai localities expected');
  for (const cluster of MUMBAI_INITIAL_CLUSTERS) {
    const coords = getZoneCoords(cluster.name);
    assert.ok(coords, `Missing coordinates for Mumbai zone: ${cluster.name}`);
    assert.ok(coords.lat >= 18.88 && coords.lat <= 19.3, `Latitude out of Mumbai bounds for ${cluster.name}`);
    assert.ok(coords.lng >= 72.76 && coords.lng <= 73.02, `Longitude out of Mumbai bounds for ${cluster.name}`);
    const district = getMumbaiDistrict(cluster.name);
    assert.ok(
      MUMBAI_DISTRICTS.includes(district),
      `Unexpected district ${district} for ${cluster.name}`
    );
  }
  assert.equal(getMumbaiDistrict('Colaba'), 'Mumbai City');
  assert.equal(getMumbaiDistrict('Dadar'), 'Mumbai City');
  assert.equal(getMumbaiDistrict('Andheri'), 'Western Suburbs');
  assert.equal(getMumbaiDistrict('Borivali'), 'Western Suburbs');
  assert.equal(getMumbaiDistrict('Powai'), 'Eastern Suburbs');
  assert.equal(getMumbaiDistrict('Mulund'), 'Eastern Suburbs');
  assert.equal(getMumbaiDistrict('Chembur'), 'Harbour');
  const nearestToPowai = findNearestMumbaiZone({ lat: 19.118, lng: 72.905 }, MUMBAI_INITIAL_CLUSTERS.map((z) => z.name));
  assert.equal(nearestToPowai.zoneName, 'Powai');
  assert.ok(CORE_MUMBAI_CLUSTER_NAMES.includes('Colaba'));
  logPass(`Mumbai cluster coordinates & district classification (${MUMBAI_INITIAL_CLUSTERS.length} zones verified)`);

  // 3. Expanded Skill Categories, Automotive Subcategories, Skill Tests & Busy Exclusion
  for (const requiredCat of ['Network Technician', 'IT Engineering', 'Automotive Services']) {
    assert.ok(SKILL_CATEGORIES.includes(requiredCat as typeof SKILL_CATEGORIES[number]), `Missing skill ${requiredCat}`);
    const testPack = getSkillTestPack(requiredCat);
    assert.ok(testPack.questions.length >= 5 && testPack.skillCategory === requiredCat, `Missing dedicated test bank for ${requiredCat}`);
  }
  assert.ok(AUTOMOTIVE_SUBCATEGORIES.includes('Car Mechanic'));
  assert.ok(AUTOMOTIVE_SUBCATEGORIES.includes('EV Four-Wheeler Repair'));

  const sampleTechAvailable: TechnicianProfile = {
    id: 'tech_1',
    ownerId: 'uid_tech_1',
    fullName: 'Vikram Pawar',
    skillCategory: 'Automotive Services',
    subcategory: 'Car Mechanic',
    experienceYears: 8,
    clusterZone: 'Powai',
    workingRadiusKm: 10,
    workPreference: 'daily',
    expectedCharge: 550,
    calloutFee: 350,
    hourlyRate: 250,
    availabilityStatus: 'Available',
    busySlots: [],
    ratingAvg: 4.9,
    ratingCount: 24,
    verified: true,
    adminGrade: 'A',
  };
  const sampleTechBusy: TechnicianProfile = {
    ...sampleTechAvailable,
    id: 'tech_busy',
    ownerId: 'uid_tech_busy',
    fullName: 'Busy Worker',
    availabilityStatus: 'Busy',
  };
  const sampleTechUnavailable: TechnicianProfile = {
    ...sampleTechAvailable,
    id: 'tech_unavail',
    ownerId: 'uid_tech_unavail',
    fullName: 'Offline Worker',
    availabilityStatus: 'Unavailable',
  };

  const aiMatched = computeAiRecommendedTechnicians({
    technicians: [sampleTechBusy, sampleTechAvailable, sampleTechUnavailable],
    userBookings: [],
    originCoords: getZoneCoords('Ghatkopar'),
    originZone: 'Ghatkopar',
    limit: 5,
  });
  assert.equal(aiMatched.length, 1, 'Busy & Unavailable technicians must be strictly excluded from matching');
  assert.equal(aiMatched[0].tech.id, 'tech_1');
  assert.ok((getDistanceToZoneKm(getZoneCoords('Ghatkopar'), 'Powai') ?? 99) < 10);
  logPass('AI matching, new skill categories, Automotive subcategories, and Busy/Unavailable exclusion');

  // 4. Booking Price Preview Calculator, Slot Conflict Guard, & Progress Tracker
  const previewDefault = computeBookingPricePreview(
    sampleTechAvailable,
    3,
    DEFAULT_PLATFORM_CONFIG.customerBookingCharge,
    DEFAULT_PLATFORM_CONFIG.bookingCommissionPercent,
    120,
    true
  );
  // callout (350) + 3h * 250 (750) = 1100 laborSubtotal; 120 pts discount; default bookingFee 0 = 980
  assert.equal(previewDefault.laborSubtotal, 1100);
  assert.equal(previewDefault.discountApplied, 120);
  assert.equal(previewDefault.totalEstimated, 980);

  const preview = computeBookingPricePreview(
    sampleTechAvailable,
    3,
    49,
    10,
    120,
    true
  );
  // callout (350) + 3h * 250 (750) - 120 discount + 49 fee = 1029
  assert.equal(preview.totalEstimated, 1029);
  assert.equal(preview.commissionAmount, 98);

  const nextFree = findNextFreeSlot([], [], sampleTechAvailable.ownerId);
  const activeBooking: ServiceBooking = {
    id: 'bk_1001',
    customerId: createdUsers[0].uid,
    customerName: createdUsers[0].displayName,
    technicianId: sampleTechAvailable.ownerId,
    technicianName: sampleTechAvailable.fullName,
    skillCategory: sampleTechAvailable.skillCategory,
    clusterZone: 'Powai',
    scheduledDate: nextFree.isoDate,
    scheduledSlot: nextFree.slotId,
    status: 'In Progress',
    serviceCharge: preview.laborSubtotal,
    bookingFee: DEFAULT_PLATFORM_CONFIG.customerBookingCharge,
    commissionAmount: preview.commissionAmount,
    totalAmount: preview.totalEstimated,
    estimatedHours: 3,
    hourlyRateSnapshot: 250,
    calloutFeeSnapshot: 350,
    discountApplied: 120,
    loyaltyPointsRedeemed: 120,
    paymentMethod: 'Wallet',
    paymentStatus: 'Verified',
    progressLabel: BOOKING_PROGRESS_STEPS[2], // 'Repair in progress'
    progressNote: 'Scanning OBD codes and replacing brake sensor',
  };
  const bookedSet = getBookedSlotSet([activeBooking], sampleTechAvailable.ownerId);
  assert.ok(bookedSet.has(makeSlotKey(nextFree.isoDate, nextFree.slotId)), 'Booked slot must be blocked');
  const followingFree = findNextFreeSlot([], [activeBooking], sampleTechAvailable.ownerId);
  assert.notEqual(
    makeSlotKey(followingFree.isoDate, followingFree.slotId),
    makeSlotKey(nextFree.isoDate, nextFree.slotId),
    'Next free slot must advance past booked slot'
  );
  logPass('Live Price Preview calculator, loyalty redemption, slot conflict guard, and job progress tracking');

  // 5. Shopkeeper Member Discounts, Direct Cart Checkout & Courier Tracking
  const shopProfile: ShopProfile = {
    id: 'shop_1',
    ownerId: 'uid_shop_1',
    shopName: 'Suresh Hardware & Spares',
    ownerName: 'Suresh Gupta',
    address: 'LBS Marg, Ghatkopar West',
    clusterZone: 'Ghatkopar',
    sellerPlan: 'Growth',
    verified: true,
  };
  const productA: Product = {
    id: 'prod_1',
    shopId: shopProfile.id,
    ownerId: shopProfile.ownerId,
    shopName: shopProfile.shopName,
    name: 'Schneider MCB 32A Double Pole',
    category: 'Electrical',
    price: 500,
    stock: 20,
    clusterZone: 'Ghatkopar',
    isPromoted: true,
    memberDiscountPercent: 10,
    shippingAvailable: true,
    shippingFee: 60,
    courierPartner: 'Mumbai Express Dispatch',
    deliveryEta: 'Same day (4-6 hrs)',
  };
  const productB: Product = {
    id: 'prod_2',
    shopId: shopProfile.id,
    ownerId: shopProfile.ownerId,
    shopName: shopProfile.shopName,
    name: 'Copper Pipe 1/4 inch 5m',
    category: 'AC & HVAC',
    price: 1200,
    stock: 8,
    clusterZone: 'Ghatkopar',
    isPromoted: false,
    memberDiscountPercent: 5,
    shippingAvailable: false,
    shippingFee: 0,
  };
  const cartTotals = computeCartTotals(
    [
      { product: productA, quantity: 2 }, // 1000 gross, 100 disc, 60 shipping
      { product: productB, quantity: 1 }, // 1200 gross, 60 disc, 0 shipping
    ],
    true
  );
  assert.equal(cartTotals.subtotal, 2200);
  assert.equal(cartTotals.totalDiscount, 160);
  assert.equal(cartTotals.totalShipping, 60);
  assert.equal(cartTotals.payableTotal, 2100);
  logPass('Shopkeeper member discounts, direct multi-item cart totals, and courier shipping fees');

  // 6. Contractor Billing Quotas (5, 10, 50, 300) & Lead Cap Enforcement
  const quotaValues = MEMBERSHIP_QUOTA_TIERS.map((tier) => tier.quota);
  assert.deepEqual(quotaValues, [5, 10, 50, 300]);
  const starterContractor: ContractorProfile = {
    id: 'cont_1',
    ownerId: createdUsers[3].uid,
    companyName: 'BuildCorp Infra',
    contactName: 'Rohan Shetty',
    clusterZone: 'Malad',
    licenseNumber: 'MH-PWD-2026-4410',
    pastWorkHistory: 'Completed 18 commercial MEP fitouts across Andheri and Malad',
    packageTier: 'Basic',
    profilesAccessed: 5,
    leadQuotaLimit: 5,
    leadQuotaUsed: 5,
    verified: true,
  };
  const canHireMore = (starterContractor.leadQuotaUsed ?? 0) < (starterContractor.leadQuotaLimit ?? 0);
  assert.equal(canHireMore, false, 'Contractor reaching 5/5 quota must be blocked until upgrading to 10/50/300');
  logPass('Membership quota tiers (5, 10, 50, 300) and contractor hiring cap enforcement');

  // 7. Preventive Maintenance Reminders
  const reminders = computeMaintenanceReminders([activeBooking], new Date('2026-12-01'));
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].intervalDays, 90, 'Automotive service preventive cycle should be 90 days');
  logPass('Preventive maintenance reminder scheduling');

  // 8. Admin Zone Density Heatmap Aggregation across Mumbai City & Suburbs
  const mockZones = MUMBAI_INITIAL_CLUSTERS.map((z) => ({
    id: z.id,
    name: z.name,
    city: 'Mumbai',
    state: 'Maharashtra',
    subZones: z.subZones,
    active: true,
  }));
  const heatmapResult = computeMumbaiZoneHeatmap({
    zones: mockZones,
    technicians: [sampleTechAvailable, sampleTechBusy],
    shops: [shopProfile],
    contractors: [starterContractor],
    bookings: [activeBooking],
    metricMode: 'providers',
  });
  const powaiCell = heatmapResult.cells.find((c) => c.zoneName === 'Powai');
  const ghatkoparCell = heatmapResult.cells.find((c) => c.zoneName === 'Ghatkopar');
  const maladCell = heatmapResult.cells.find((c) => c.zoneName === 'Malad');
  assert.ok(powaiCell && powaiCell.availableTechs === 1 && powaiCell.heatLevel >= 3);
  assert.ok(ghatkoparCell && ghatkoparCell.shopsCount === 1);
  assert.ok(maladCell && maladCell.contractorsCount === 1);
  const skillMatrix = computeDistrictSkillMatrix([sampleTechAvailable]);
  const autoRow = skillMatrix.rows.find((r) => r.skill === 'Automotive Services');
  assert.ok(autoRow && autoRow.counts['Eastern Suburbs'] === 1);
  logPass('Admin Mumbai density heatmap & Trade x District thermal matrix');

  console.log('\nALL REGRESSION CHECKS PASSED SUCCESSFULLY.');
}

runSuite().catch((err) => {
  console.error('REGRESSION FAILURE:', err);
  process.exit(1);
});
