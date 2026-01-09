// Regional Package Definitions
// 3-month minimum commitment, billed monthly
// Bundle discount: 40% off à la carte total for retail, then 50% off for early adopters

import { ARIZONA_CITIES, CityPricingData, PREMIUM_CITIES, Region } from './arizonaCityPricing';

export type BundleCategory = 'market-type' | 'metro-phoenix' | 'arizona-regional';

export interface RegionalPackage {
  id: string;
  name: string;
  description: string;
  category: BundleCategory;
  includedCityIds: string[];
  excludedPremiumCities: string[];
  // Pricing breakdown
  alaCarteTotal: number;      // Sum of individual city prices
  retailTotal: number;        // 40% off à la carte
  earlyAdopterPrice: number;  // 50% off retail
  bundleSavings: number;      // How much saved vs à la carte
  isPremiumPackage?: boolean;
}

// Calculate package prices with bundle discount
// Formula: à la carte total → 40% discount = retail → 50% discount = early adopter
function calculateBundlePrice(cityIds: string[]): { 
  alaCarte: number; 
  retail: number; 
  earlyAdopter: number;
  bundleSavings: number;
} {
  const cities = ARIZONA_CITIES.filter(c => cityIds.includes(c.id));
  const alaCarte = cities.reduce((sum, c) => sum + c.retailPrice, 0);
  const retail = Math.round(alaCarte * 0.6); // 40% bundle discount
  const earlyAdopter = Math.round(retail * 0.5); // 50% early adopter discount
  const bundleSavings = alaCarte - earlyAdopter;
  return { alaCarte, retail, earlyAdopter, bundleSavings };
}

// === MARKET-TYPE BUNDLES ===

// Luxury Markets (4 cities per spec)
const luxuryMarketsCities = ['scottsdale', 'paradise-valley', 'carefree', 'cave-creek'];
const luxuryMarketsPrices = calculateBundlePrice(luxuryMarketsCities);

// === METRO PHOENIX COVERAGE ===

// Central Corridor (1 city)
const centralCorridorCities = ['phoenix'];
const centralCorridorPrices = calculateBundlePrice(centralCorridorCities);

// East Valley (9 cities per spec)
const eastValleyCities = [
  'mesa', 'chandler', 'gilbert', 'tempe', 'apache-junction', 
  'san-tan-valley', 'fountain-hills', 'gold-canyon', 'sun-lakes'
];
const eastValleyPrices = calculateBundlePrice(eastValleyCities);

// North Valley (4 cities per spec)
const northValleyCities = ['anthem', 'new-river', 'rio-verde', 'wickenburg'];
const northValleyPrices = calculateBundlePrice(northValleyCities);

// West Valley (13 cities per spec)
const westValleyCities = [
  'glendale', 'peoria', 'surprise', 'goodyear', 'buckeye', 
  'avondale', 'litchfield-park', 'el-mirage', 'tolleson', 
  'youngtown', 'sun-city', 'sun-city-west', 'laveen'
];
const westValleyPrices = calculateBundlePrice(westValleyCities);

// South Valley (3 cities per spec)
const southValleyCities = ['maricopa', 'gila-bend', 'queen-creek'];
const southValleyPrices = calculateBundlePrice(southValleyCities);

// === ARIZONA REGIONAL COVERAGE ===

// Northern Arizona (8 cities per spec)
const northernAZCities = [
  'flagstaff', 'sedona', 'prescott', 'prescott-valley', 
  'cottonwood', 'payson', 'show-low', 'winslow'
];
const northernAZPrices = calculateBundlePrice(northernAZCities);

// Western Arizona (4 cities per spec)
const westernAZCities = ['lake-havasu-city', 'bullhead-city', 'kingman', 'yuma'];
const westernAZPrices = calculateBundlePrice(westernAZCities);

// Southern Arizona (6 cities per spec)
const southernAZCities = ['tucson', 'casa-grande', 'sierra-vista', 'nogales', 'benson', 'douglas'];
const southernAZPrices = calculateBundlePrice(southernAZCities);

// Central Arizona (2 cities per spec)
const centralAZCities = ['florence', 'coolidge'];
const centralAZPrices = calculateBundlePrice(centralAZCities);

export const REGIONAL_PACKAGES: RegionalPackage[] = [
  // Market-Type Bundles
  {
    id: 'luxury-markets',
    name: 'Luxury Markets',
    description: 'Scottsdale, Paradise Valley, Carefree, Cave Creek',
    category: 'market-type',
    includedCityIds: luxuryMarketsCities,
    excludedPremiumCities: [],
    alaCarteTotal: luxuryMarketsPrices.alaCarte,
    retailTotal: luxuryMarketsPrices.retail,
    earlyAdopterPrice: luxuryMarketsPrices.earlyAdopter,
    bundleSavings: luxuryMarketsPrices.bundleSavings,
    isPremiumPackage: true,
  },
  
  // Metro Phoenix Coverage
  {
    id: 'central-corridor',
    name: 'Central Corridor',
    description: 'Phoenix',
    category: 'metro-phoenix',
    includedCityIds: centralCorridorCities,
    excludedPremiumCities: [],
    alaCarteTotal: centralCorridorPrices.alaCarte,
    retailTotal: centralCorridorPrices.retail,
    earlyAdopterPrice: centralCorridorPrices.earlyAdopter,
    bundleSavings: centralCorridorPrices.bundleSavings,
  },
  {
    id: 'east-valley',
    name: 'East Valley',
    description: 'Mesa, Chandler, Gilbert, Tempe & more',
    category: 'metro-phoenix',
    includedCityIds: eastValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: eastValleyPrices.alaCarte,
    retailTotal: eastValleyPrices.retail,
    earlyAdopterPrice: eastValleyPrices.earlyAdopter,
    bundleSavings: eastValleyPrices.bundleSavings,
  },
  {
    id: 'north-valley',
    name: 'North Valley',
    description: 'Anthem, New River, Rio Verde, Wickenburg',
    category: 'metro-phoenix',
    includedCityIds: northValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: northValleyPrices.alaCarte,
    retailTotal: northValleyPrices.retail,
    earlyAdopterPrice: northValleyPrices.earlyAdopter,
    bundleSavings: northValleyPrices.bundleSavings,
  },
  {
    id: 'west-valley',
    name: 'West Valley',
    description: 'Glendale, Peoria, Surprise, Goodyear & more',
    category: 'metro-phoenix',
    includedCityIds: westValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: westValleyPrices.alaCarte,
    retailTotal: westValleyPrices.retail,
    earlyAdopterPrice: westValleyPrices.earlyAdopter,
    bundleSavings: westValleyPrices.bundleSavings,
  },
  {
    id: 'south-valley',
    name: 'South Valley',
    description: 'Maricopa, Gila Bend, Queen Creek',
    category: 'metro-phoenix',
    includedCityIds: southValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: southValleyPrices.alaCarte,
    retailTotal: southValleyPrices.retail,
    earlyAdopterPrice: southValleyPrices.earlyAdopter,
    bundleSavings: southValleyPrices.bundleSavings,
  },
  
  // Arizona Regional Coverage
  {
    id: 'northern-arizona',
    name: 'Northern Arizona',
    description: 'Flagstaff, Sedona, Prescott & more',
    category: 'arizona-regional',
    includedCityIds: northernAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: northernAZPrices.alaCarte,
    retailTotal: northernAZPrices.retail,
    earlyAdopterPrice: northernAZPrices.earlyAdopter,
    bundleSavings: northernAZPrices.bundleSavings,
  },
  {
    id: 'western-arizona',
    name: 'Western Arizona',
    description: 'Lake Havasu City, Bullhead City, Kingman, Yuma',
    category: 'arizona-regional',
    includedCityIds: westernAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: westernAZPrices.alaCarte,
    retailTotal: westernAZPrices.retail,
    earlyAdopterPrice: westernAZPrices.earlyAdopter,
    bundleSavings: westernAZPrices.bundleSavings,
  },
  {
    id: 'southern-arizona',
    name: 'Southern Arizona',
    description: 'Tucson, Casa Grande, Sierra Vista & more',
    category: 'arizona-regional',
    includedCityIds: southernAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: southernAZPrices.alaCarte,
    retailTotal: southernAZPrices.retail,
    earlyAdopterPrice: southernAZPrices.earlyAdopter,
    bundleSavings: southernAZPrices.bundleSavings,
  },
  {
    id: 'central-arizona',
    name: 'Central Arizona',
    description: 'Florence, Coolidge',
    category: 'arizona-regional',
    includedCityIds: centralAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: centralAZPrices.alaCarte,
    retailTotal: centralAZPrices.retail,
    earlyAdopterPrice: centralAZPrices.earlyAdopter,
    bundleSavings: centralAZPrices.bundleSavings,
  },
];

// Category labels for display
export const BUNDLE_CATEGORY_LABELS: Record<BundleCategory, string> = {
  'market-type': 'Market-Type Bundles',
  'metro-phoenix': 'Metro Phoenix Coverage',
  'arizona-regional': 'Arizona Regional Coverage',
};

// Category microcopy
export const BUNDLE_CATEGORY_MICROCOPY: Record<BundleCategory, string> = {
  'market-type': 'For agents specializing in high-end properties across multiple luxury communities.',
  'metro-phoenix': 'Coverage across the greater Phoenix metropolitan area.',
  'arizona-regional': 'Statewide coverage beyond the Phoenix metro.',
};

// Get package by ID
export function getPackageById(packageId: string): RegionalPackage | undefined {
  return REGIONAL_PACKAGES.find(p => p.id === packageId);
}

// Get cities included in a package
export function getPackageCities(packageId: string): CityPricingData[] {
  const pkg = getPackageById(packageId);
  if (!pkg) return [];
  return ARIZONA_CITIES.filter(c => pkg.includedCityIds.includes(c.id));
}

// Get premium package
export function getPremiumPackage(): RegionalPackage {
  return REGIONAL_PACKAGES.find(p => p.isPremiumPackage)!;
}

// Get non-premium packages (regional only)
export function getRegionalPackages(): RegionalPackage[] {
  return REGIONAL_PACKAGES.filter(p => !p.isPremiumPackage);
}

// Get packages by category
export function getPackagesByCategory(category: BundleCategory): RegionalPackage[] {
  return REGIONAL_PACKAGES.filter(p => p.category === category);
}
