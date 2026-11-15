import type { MumbaiDistrict, PlatformConfig } from '../types';

export const ADMIN_EMAIL = 'allinoneskills2019@gmail.com';

export const CORE_MUMBAI_CLUSTER_NAMES = [
  'Colaba',
  'Mahim',
  'Bandra',
  'Khar',
  'Santacruz',
  'Andheri',
  'Jogeshwari',
  'Borivali',
] as const;

export const MUMBAI_INITIAL_CLUSTERS = [
  // Core 8 Launch Clusters
  { id: 'colaba', name: 'Colaba', subZones: ['Cuffe Parade', 'Navy Nagar', 'Apollo Bunder'] },
  { id: 'mahim', name: 'Mahim', subZones: ['Mahim West', 'Shivaji Park North', 'Mori Road'] },
  { id: 'bandra', name: 'Bandra', subZones: ['District Headquarters', 'Pali Hill', 'BKC', 'Bandra East'] },
  { id: 'khar', name: 'Khar', subZones: ['Khar West', 'Khar Danda', 'Linking Road'] },
  { id: 'santacruz', name: 'Santacruz', subZones: ['Santacruz West', 'Kalina', 'Vakola'] },
  { id: 'andheri', name: 'Andheri', subZones: ['Lokhandwala', 'MIDC', 'Andheri East'] },
  { id: 'jogeshwari', name: 'Jogeshwari', subZones: ['Oshiwara', 'JVLR', 'Jogeshwari West'] },
  { id: 'borivali', name: 'Borivali', subZones: ['IC Colony', 'Shimpoli', 'Borivali East'] },

  // South Mumbai / Mumbai City Neighbourhoods & Localities
  { id: 'antop_hill', name: 'Antop Hill', subZones: ['CG Road', 'Sion Koliwada', 'Shaikh Misry'] },
  { id: 'agripada', name: 'Agripada', subZones: ['Saat Rasta', 'Jacob Circle', 'Madanpura'] },
  { id: 'bhuleshwar', name: 'Bhuleshwar', subZones: ['Panjrapole', 'Bhoiwada', 'CP Tank'] },
  { id: 'byculla', name: 'Byculla', subZones: ['Byculla East', 'Byculla West', 'Rani Baug'] },
  { id: 'chinchpokli', name: 'Chinchpokli', subZones: ['Chinchpokli East', 'Chinchpokli West', 'Kala Chowki'] },
  { id: 'cumballa_hill', name: 'Cumballa Hill', subZones: ['Cumbala Hill', 'Pedder Road', 'Breach Candy'] },
  { id: 'dadar', name: 'Dadar', subZones: ['Dadar West', 'Dadar East', 'Shivaji Park', 'TT Circle'] },
  { id: 'dharavi', name: 'Dharavi', subZones: ['90 Feet Road', 'Kumbharwada', 'Sion Bandra Link'] },
  { id: 'dongri', name: 'Dongri', subZones: ['Dongri Market', 'Noor Baug', 'Bhendi Bazaar'] },
  { id: 'fort', name: 'Fort', subZones: ['Horniman Circle', 'Ballard Estate', 'Kala Ghoda'] },
  { id: 'gamdevi', name: 'Gamdevi', subZones: ['August Kranti Maidan', 'Gowalia Tank', 'Nana Chowk'] },
  { id: 'girgaon', name: 'Girgaon', subZones: ['Girgaon Chowpatty', 'Thakurdwar', 'Charni Road'] },
  { id: 'grant_road', name: 'Grant Road', subZones: ['Grant Road East', 'Grant Road West', 'Lamington Road'] },
  { id: 'kalbadevi', name: 'Kalbadevi', subZones: ['Princess Street', 'Zaveri Bazaar', 'Marine Lines'] },
  { id: 'kamathipura', name: 'Kamathipura', subZones: ['Bellasis Road', 'Shuklaji Street', 'Mumbai Central'] },
  { id: 'lower_parel', name: 'Lower Parel', subZones: ['Kamala Mills', 'Senapati Bapat Marg', 'Currey Road'] },
  { id: 'malabar_hill', name: 'Malabar Hill', subZones: ['Walkeshwar', 'Nepean Sea Road', 'Hanging Gardens'] },
  { id: 'mandvi', name: 'Mandvi', subZones: ['Masjid Bunder', 'Crawford Market', 'Carnac Bunder'] },
  { id: 'matunga', name: 'Matunga', subZones: ['Matunga East', 'Matunga West', 'Five Gardens', 'Kings Circle'] },
  { id: 'mazgaon', name: 'Mazgaon', subZones: ['Dockyard Road', 'Mazgaon Garden', 'Reay Road'] },
  { id: 'nagpada', name: 'Nagpada', subZones: ['Clare Road', 'Sankli Street', 'Byculla West'] },
  { id: 'naigaon', name: 'Naigaon', subZones: ['Dadar Naigaon', 'Wadala West', 'Spring Mill'] },
  { id: 'nariman_point', name: 'Nariman Point', subZones: ['Marine Drive', 'Vidhan Bhavan', 'Backbay Reclamation'] },
  { id: 'opera_house', name: 'Opera House', subZones: ['Panchratna', 'Hughes Road', 'Kennedy Bridge'] },
  { id: 'parel', name: 'Parel', subZones: ['Parel Village', 'KEM Hospital Area', 'Lal Baug'] },
  { id: 'prabhadevi', name: 'Prabhadevi', subZones: ['Siddhivinayak', 'Century Bazaar', 'Ravindra Natya'] },
  { id: 'sewri', name: 'Sewri', subZones: ['Sewri Cross Road', 'Sewri Timber Pond', 'Wadala East'] },
  { id: 'sion', name: 'Sion', subZones: ['Sion Circle', 'Sion East', 'Sion West', 'Pratiksha Nagar'] },
  { id: 'tardeo', name: 'Tardeo', subZones: ['Haji Ali', 'Tardeo AC Market', 'Altamount Road'] },
  { id: 'umarkhadi', name: 'Umarkhadi', subZones: ['Sandhurst Road', 'Nowroji Hill', 'Jail Road'] },
  { id: 'worli', name: 'Worli', subZones: ['Worli Sea Face', 'Worli Naka', 'Annie Besant Road'] },

  // 1. Western Suburbs (Andheri & Borivali Talukas)
  { id: 'vile_parle', name: 'Vile Parle', subZones: ['Vile Parle East', 'Vile Parle West', 'Airport Road'] },
  { id: 'juhu', name: 'Juhu', subZones: ['Juhu Tara Road', 'JVPD Scheme', 'Juhu Beach'] },
  { id: 'goregaon', name: 'Goregaon', subZones: ['Goregaon East', 'Goregaon West', 'Film City', 'Bangur Nagar'] },
  { id: 'malad', name: 'Malad', subZones: ['Malad West', 'Malad East', 'Mindspace', 'Orlem'] },
  { id: 'kandivali', name: 'Kandivali', subZones: ['Thakur Village', 'Mahavir Nagar', 'Charkop'] },
  { id: 'dahisar', name: 'Dahisar', subZones: ['Dahisar East', 'Dahisar West', 'Rawalpada'] },
  { id: 'gorai_manori', name: 'Gorai & Manori', subZones: ['Gorai Creek', 'Manori Village', 'Uttan Link'] },

  // 2. Eastern Suburbs (Kurla Taluka)
  { id: 'kurla', name: 'Kurla', subZones: ['Kurla West', 'Kurla East', 'Nehru Nagar', 'BKC Annex'] },
  { id: 'vidyavihar', name: 'Vidyavihar', subZones: ['Vidyavihar West', 'Vidyavihar East', 'Somaiya Campus'] },
  { id: 'ghatkopar', name: 'Ghatkopar', subZones: ['Ghatkopar East', 'Ghatkopar West', 'Pant Nagar', 'R City'] },
  { id: 'vikhroli', name: 'Vikhroli', subZones: ['Vikhroli West', 'Vikhroli East', 'Godrej Creek', 'Kannamwar Nagar'] },
  { id: 'kanjurmarg', name: 'Kanjurmarg', subZones: ['Kanjurmarg West', 'Kanjurmarg East', 'LBS Marg'] },
  { id: 'bhandup', name: 'Bhandup', subZones: ['Bhandup West', 'Bhandup East', 'Nahur', 'Dreams Mall'] },
  { id: 'mulund', name: 'Mulund', subZones: ['Mulund West', 'Mulund East', 'Check Naka', 'LBS Marg'] },
  { id: 'powai', name: 'Powai', subZones: ['Hiranandani Gardens', 'Chandivali', 'IIT Bombay'] },

  // 3. Harbour / Central Suburbs & Trombay Area
  { id: 'chembur', name: 'Chembur', subZones: ['Chembur Camp', 'Diamond Garden', 'Tilak Nagar', 'RCF'] },
  { id: 'govandi', name: 'Govandi', subZones: ['Deonar', 'Govandi East', 'Lotus Colony'] },
  { id: 'mankhurd', name: 'Mankhurd', subZones: ['Mankhurd West', 'Mankhurd East', 'Maharashtra Nagar'] },
  { id: 'trombay', name: 'Trombay', subZones: ['Anushakti Nagar', 'BARC Colony', 'Trombay Jetty'] },
];


export const SKILL_CATEGORIES = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'AC Technician',
  'Painter',
  'Welder',
  'Mason',
  'Civil Worker',
  'CCTV Technician',
  'RO Technician',
  'Appliance Repair',
  'Cleaning Services',
  'Computer Repairing',
  'Software',
  'Hardware',
  'Networking',
  'Network Technician',
  'IT Engineering',
  'Automotive Services',
  'Other Skills',
] as const;

export const AUTOMOTIVE_SUBCATEGORIES = [
  'Car Mechanic',
  'Bike Mechanic',
  'EV Bike Technician',
  'EV Four-Wheeler Repair',
  'Four-Wheeler Scanner Specialist',
  'Two-Wheeler & Four-Wheeler Garage Mechanic',
  'EV Two-Wheeler & Four-Wheeler Mechanic',
] as const;

export const BOOKING_PROGRESS_STEPS = [
  'Diagnostic complete',
  'Parts ordered',
  'Repair in progress',
  'Out for delivery',
] as const;

export const MEMBERSHIP_QUOTA_TIERS = [
  {
    id: 'starter_5',
    quota: 5,
    packageTier: 'Basic' as const,
    name: 'Starter 5',
    targetAudience: 'Independent technicians & trial leads',
    defaultPrice: 499,
    validityDays: 30,
    features: 'Up to 5 verified leads/categories per cycle',
  },
  {
    id: 'basic_10',
    quota: 10,
    packageTier: 'Basic' as const,
    name: 'Growth 10',
    targetAudience: 'Active Mumbai zone specialists',
    defaultPrice: 999,
    validityDays: 30,
    features: 'Up to 10 verified leads/categories + priority cluster visibility',
  },
  {
    id: 'pro_50',
    quota: 50,
    packageTier: 'Professional' as const,
    name: 'Professional 50',
    targetAudience: 'Mid-size contractors & multi-skill teams',
    defaultPrice: 3499,
    validityDays: 90,
    features: '50 leads/categories + direct recruitment & multi-site dispatch',
  },
  {
    id: 'enterprise_300',
    quota: 300,
    packageTier: 'Premium' as const,
    name: 'Enterprise 300',
    targetAudience: 'Large builders & regional fleet partners',
    defaultPrice: 12999,
    validityDays: 365,
    features: '300 leads/categories + all-Mumbai cluster priority & dedicated support',
  },
] as const;

export const MUMBAI_DISTRICTS: MumbaiDistrict[] = [
  'All Mumbai',
  'Mumbai City',
  'Western Suburbs',
  'Eastern Suburbs',
  'Harbour',
];

const WESTERN_SUBURB_NAMES = new Set([
  'bandra',
  'khar',
  'santacruz',
  'andheri',
  'jogeshwari',
  'borivali',
  'vile parle',
  'juhu',
  'goregaon',
  'malad',
  'kandivali',
  'dahisar',
  'gorai & manori',
]);

const EASTERN_SUBURB_NAMES = new Set([
  'kurla',
  'vidyavihar',
  'ghatkopar',
  'vikhroli',
  'kanjurmarg',
  'bhandup',
  'mulund',
  'powai',
]);

const HARBOUR_SUBURB_NAMES = new Set(['chembur', 'govandi', 'mankhurd', 'trombay']);

export function getMumbaiDistrict(zoneName: string): Exclude<MumbaiDistrict, 'All Mumbai'> {
  const key = (zoneName || '').trim().toLowerCase();
  if (WESTERN_SUBURB_NAMES.has(key)) return 'Western Suburbs';
  if (EASTERN_SUBURB_NAMES.has(key)) return 'Eastern Suburbs';
  if (HARBOUR_SUBURB_NAMES.has(key)) return 'Harbour';
  return 'Mumbai City';
}

export const SKILL_SEARCH_SYNONYMS: Record<string, string[]> = {
  'Computer Repairing': ['कंप्यूटर रिपेयरिंग', 'संगणक दुरुस्ती', 'computer repair', 'laptop repair', 'pc repair', 'desktop'],
  Software: ['सॉफ्टवेयर', 'सॉफ्टवेअर', 'software', 'os install', 'windows', 'driver', 'antivirus'],
  Hardware: ['हार्डवेयर', 'हार्डवेअर', 'hardware', 'motherboard', 'ram', 'ssd', 'hdd', 'smps'],
  Networking: ['नेटवर्किंग', 'networking', 'wifi', 'router', 'lan', 'switch', 'ethernet', 'cabling'],
  'Network Technician': ['network technician', 'structured cabling', 'firewall', 'fiber', 'isp', 'switch', 'ap'],
  'IT Engineering': ['it engineering', 'it engineer', 'server', 'cloud', 'workstation', 'enterprise it', 'sysadmin'],
  'Automotive Services': [
    'automotive',
    'car mechanic',
    'bike mechanic',
    'ev bike technician',
    'ev four-wheeler repair',
    'four-wheeler scanner specialist',
    'two-wheeler & four-wheeler garage mechanic',
    'ev two-wheeler & four-wheeler mechanic',
    'ev',
    'obd scanner',
    'garage',
  ],
};

export const PRODUCT_CATEGORIES = [
  'Electrical & Wiring',
  'Plumbing & Sanitary',
  'Hardware & Fasteners',
  'Paints & Waterproofing',
  'Power Tools',
  'HVAC & Cooling Parts',
  'CCTV & Security Gear',
  'Civil & Cement Supplies',
  'IT & Networking Gear',
  'Automotive & EV Spares',
] as const;

export const WORKING_RADII: Array<3 | 5 | 10> = [3, 5, 10];

export const AI_MANAGEMENT_ROLES = [
  { role: 'AI CEO', scope: 'Overall marketplace strategy, GMV, and cross-zone operations' },
  { role: 'AI HR Manager', scope: 'Technician registration, skill distribution, and workforce readiness' },
  { role: 'AI Verification Manager', scope: 'KYC review queues and trust compliance checks' },
  { role: 'AI Marketing Manager', scope: 'Promotions, shopkeeper ad campaigns, and cluster growth' },
  { role: 'AI Customer Support', scope: 'Customer dispute triage, FAQs, and service follow-ups' },
  { role: 'AI Call Center', scope: 'Incoming and outgoing booking coordination scripts' },
  { role: 'AI Zone Manager', scope: 'Mumbai cluster supply-demand balance by locality' },
  { role: 'AI Booking Manager', scope: 'Cluster proximity matching and availability enforcement' },
  { role: 'AI Accounts Manager', scope: 'Commission ledger, memberships, and payout reconciliation' },
] as const;

// All pricing starts unconfigured (0) until explicitly set by the Administrator in Master Dashboard
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  bookingCommissionPercent: 0,
  customerBookingCharge: 0,
  technicianMonthlyFee: 0,
  technicianYearlyFee: 0,
  promotionDailyRate: 0,
  contractorPackages: [
    {
      tier: 'Basic',
      price: 0,
      validityDays: 30,
      profileLimit: 10,
      features: 'Access up to configured worker profile limit and project posting',
    },
    {
      tier: 'Professional',
      price: 0,
      validityDays: 90,
      profileLimit: 50,
      features: 'Priority worker search, direct recruitment requests, multi-site tracking',
    },
    {
      tier: 'Premium',
      price: 0,
      validityDays: 365,
      profileLimit: 250,
      features: 'Unlimited cluster search, dedicated AI Zone Manager alerts, bulk hiring',
    },
  ],
  shopkeeperPlans: [
    {
      tier: 'Standard',
      price: 0,
      validityDays: 30,
      profileLimit: 25,
      features: 'Storefront listing and order management',
    },
    {
      tier: 'Growth',
      price: 0,
      validityDays: 90,
      profileLimit: 150,
      features: 'Featured cluster placement and enquiry alerts',
    },
    {
      tier: 'Enterprise',
      price: 0,
      validityDays: 365,
      profileLimit: 1000,
      features: 'Priority promotion credits and multi-cluster catalog reach',
    },
  ],
};

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120) || 'doc_id';
}

export function getExperienceCategory(years: number): 'A' | 'B' | 'C' {
  const y = Number(years) || 0;
  if (y >= 5) return 'A';
  if (y >= 2) return 'B';
  return 'C';
}

export function getCategoryTierDescription(cat: 'A' | 'B' | 'C'): string {
  if (cat === 'A') return 'Category A · Senior / Master (5+ yrs)';
  if (cat === 'B') return 'Category B · Skilled / Intermediate (2–4 yrs)';
  return 'Category C · Junior / Apprentice (0–1 yr)';
}

