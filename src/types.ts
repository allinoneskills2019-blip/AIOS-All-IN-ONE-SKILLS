export type UserRole = 'customer' | 'shopkeeper' | 'contractor' | 'technician' | 'admin';

export type AvailabilityStatus = 'Available' | 'Busy' | 'Unavailable';
export type TechnicianCategoryGrade = 'A' | 'B' | 'C';

export interface UserAccount {
  uid: string;
  displayName: string;
  role: UserRole;
  phoneVerified: boolean;
  clusterZone: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivatePII {
  uid: string;
  phone: string;
  email?: string;
  fullAddress?: string;
  kycStatus: 'unsubmitted' | 'pending' | 'verified' | 'rejected';
  aadhaarLast4?: string;
  upiOrBankRef?: string;
  whatsappOptIn: boolean;
  updatedAt?: unknown;
}

export interface TechnicianProfile {
  id: string;
  ownerId: string;
  fullName: string;
  photoUrl?: string;
  skillCategory: string;
  subcategory?: string;
  experienceYears: number;
  experienceCategory?: TechnicianCategoryGrade;
  adminGrade?: TechnicianCategoryGrade | 'Pending';
  adminGradeNotes?: string;
  mockTestScore?: number;
  mockTestStatus?: 'Not Taken' | 'Submitted';
  fieldTestScore?: number;
  fieldTestStatus?: 'Pending' | 'Scheduled' | 'Passed' | 'Needs Retest';
  credentialsCount?: number;
  credentialDocIds?: string[];
  workDescription?: string;
  previousWorkPhotos?: string[];
  preferredLocations?: string[];
  clusterZone: string;
  workingRadiusKm: 3 | 5 | 10;
  workPreference: 'daily' | 'monthly' | 'both';
  expectedCharge: number;
  hourlyRate?: number;
  calloutFee?: number;
  upiId?: string;
  availabilityStatus: AvailabilityStatus;
  busySlots?: string[];
  ratingAvg?: number;
  ratingCount?: number;
  lastReviewBookingId?: string;
  completedJobsCount?: number;
  verified: boolean;
  membershipStatus?: 'none' | 'active' | 'expired';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ShopProfile {
  id: string;
  ownerId: string;
  shopName: string;
  ownerName: string;
  address: string;
  clusterZone: string;
  sellerPlan: 'Standard' | 'Growth' | 'Enterprise';
  verified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  shopId: string;
  ownerId: string;
  shopName: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  price: number;
  stock: number;
  clusterZone: string;
  isPromoted: boolean;
  promotionNote?: string;
  memberDiscountPercent?: number;
  shippingAvailable?: boolean;
  shippingFee?: number;
  courierPartner?: string;
  deliveryEta?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContractorProfile {
  id: string;
  ownerId: string;
  companyName: string;
  contactName: string;
  clusterZone: string;
  specialization?: string;
  licenseNumber?: string;
  pastWorkHistory?: string;
  packageTier: 'None' | 'Basic' | 'Professional' | 'Premium';
  profilesAccessed: number;
  leadQuotaLimit?: number;
  leadQuotaUsed?: number;
  membershipExpiresAt?: string;
  verified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectRequirement {
  id: string;
  contractorId: string;
  companyName: string;
  title: string;
  description?: string;
  clusterZone: string;
  requiredSkill: string;
  workersNeeded: number;
  hiredCount: number;
  engagementType: 'daily' | 'monthly' | 'contract';
  budgetPerWorker: number;
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkforceHire {
  id: string;
  projectId: string;
  projectTitle: string;
  contractorId: string;
  technicianId: string;
  technicianName: string;
  engagementType: 'daily' | 'monthly' | 'contract';
  agreedRate: number;
  status: 'Requested' | 'Active' | 'Completed' | 'Declined';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ServiceBooking {
  id: string;
  customerId: string;
  customerName: string;
  technicianId: string;
  technicianName: string;
  skillCategory: string;
  clusterZone: string;
  serviceNotes?: string;
  scheduledDate: string;
  scheduledSlot?: string;
  priority?: 'Standard' | 'Urgent';
  status: 'Requested' | 'Accepted' | 'In Progress' | 'Completed' | 'Cancelled' | 'Rejected';
  serviceCharge: number;
  bookingFee: number;
  commissionAmount: number;
  totalAmount: number;
  estimatedHours?: number;
  hourlyRateSnapshot?: number;
  calloutFeeSnapshot?: number;
  discountApplied?: number;
  loyaltyPointsRedeemed?: number;
  paymentMethod?: 'UPI' | 'Wallet' | 'Card';
  paymentStatus: 'Unpaid' | 'Pending Verification' | 'Verified';
  paymentReference?: string;
  progressLabel?: 'Diagnostic complete' | 'Parts ordered' | 'Repair in progress' | 'Out for delivery';
  progressNote?: string;
  rating?: number;
  reviewText?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductOrder {
  id: string;
  customerId: string;
  customerName: string;
  shopId: string;
  shopOwnerId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  memberDiscountApplied?: number;
  shippingFee?: number;
  paymentMethod?: 'UPI' | 'Wallet' | 'Card';
  shippingAddress?: string;
  courierName?: string;
  trackingId?: string;
  shippingStatus?: 'Packed' | 'Shipped' | 'In Transit' | 'Out for Delivery' | 'Delivered';
  clusterZone: string;
  status: 'Placed' | 'Confirmed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Pending Verification' | 'Verified';
  paymentReference?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Enquiry {
  id: string;
  customerId: string;
  customerName: string;
  shopId: string;
  shopOwnerId: string;
  productId?: string;
  message: string;
  reply?: string;
  status: 'Open' | 'Replied' | 'Closed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Complaint {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterRole: 'customer' | 'shopkeeper' | 'contractor' | 'technician';
  subject: string;
  description: string;
  referenceId?: string;
  status: 'Open' | 'Under Review' | 'Resolved' | 'Escalated';
  resolutionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  channel: 'in_app' | 'sms_otp' | 'whatsapp';
  category: 'booking' | 'job' | 'payment' | 'subscription' | 'system';
  read: boolean;
  createdAt?: unknown;
}

export interface ZoneCluster {
  id: string;
  name: string;
  city: string;
  state: string;
  subZones: string[];
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PackageConfig {
  tier: 'Basic' | 'Professional' | 'Premium' | 'Standard' | 'Growth' | 'Enterprise';
  price: number;
  validityDays: number;
  profileLimit: number;
  features: string;
}

export interface PlatformConfig {
  bookingCommissionPercent: number;
  customerBookingCharge: number;
  technicianMonthlyFee: number;
  technicianYearlyFee: number;
  promotionDailyRate: number;
  contractorPackages: PackageConfig[];
  shopkeeperPlans: PackageConfig[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AIDecisionProposal {
  id: string;
  agentRole: string;
  zone?: string;
  title: string;
  summary: string;
  recommendedAction?: string;
  requiresApproval: boolean;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected' | 'Informational';
  approvedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RevenueTransaction {
  id: string;
  userId: string;
  userName: string;
  txType:
    | 'booking_payment'
    | 'order_payment'
    | 'technician_membership'
    | 'contractor_package'
    | 'seller_plan'
    | 'product_promotion'
    | 'wallet_topup'
    | 'wallet_payment';
  amount: number;
  commissionAmount: number;
  referenceId?: string;
  utrReference: string;
  paymentMethod?: 'UPI' | 'Wallet' | 'Card';
  status: 'Pending Verification' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TechnicianTestAttempt {
  id: string;
  technicianId: string;
  technicianName: string;
  skillCategory: string;
  experienceYears: number;
  experienceCategory: TechnicianCategoryGrade;
  mockScore: number;
  correctAnswers: number;
  totalQuestions: number;
  practicalSelfChecklist: string[];
  fieldReadinessNotes?: string;
  fieldTestStatus: 'Pending' | 'Scheduled' | 'Passed' | 'Needs Retest';
  fieldTestScore?: number;
  assignedGrade: TechnicianCategoryGrade | 'Pending';
  adminRemarks?: string;
  gradedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TechnicianCredential {
  id: string;
  technicianId: string;
  technicianName: string;
  docType: 'Certificate' | 'License' | 'Degree';
  title: string;
  issuer?: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  storagePath?: string;
  downloadUrl?: string;
  fileDataUrl?: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  adminNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TechnicianReview {
  id: string;
  bookingId: string;
  technicianId: string;
  technicianName: string;
  customerId: string;
  customerName: string;
  skillCategory: string;
  clusterZone: string;
  rating: number;
  reviewText: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SavedFavoriteType = 'technician' | 'contractor' | 'shop';

export interface SavedFavorite {
  id: string;
  userId: string;
  targetType: SavedFavoriteType;
  targetId: string;
  targetName: string;
  category?: string;
  clusterZone: string;
  createdAt?: unknown;
}

export interface UserWallet {
  uid: string;
  balance: number;
  totalCredited: number;
  totalSpent: number;
  lastTransactionRef?: string;
  updatedAt?: unknown;
}

export interface UserRewards {
  uid: string;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: 'Silver' | 'Gold' | 'Platinum';
  updatedAt?: unknown;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type MumbaiDistrict =
  | 'All Mumbai'
  | 'Mumbai City'
  | 'Western Suburbs'
  | 'Eastern Suburbs'
  | 'Harbour';


