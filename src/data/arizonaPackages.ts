// Regional Package Definitions
// 3-month minimum commitment, billed monthly
// Bundle discount: 40% off à la carte total for retail, then 50% off for early adopters

import { ARIZONA_CITIES, CityPricingData, PREMIUM_CITIES, Region } from './arizonaCityPricing';

export interface RegionalPackage {
  id: string;
  name: string;
  description: string;
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

// === PREMIUM CITIES PACKAGE (Luxury) ===
// Scottsdale ($600), North Scottsdale ($600), Paradise Valley ($800), Carefree ($400), Cave Creek ($400)
// Total à la carte: $2,800
const premiumCityIds = ['scottsdale', 'north-scottsdale', 'paradise-valley', 'carefree', 'cave-creek'];
const premiumPrices = calculateBundlePrice(premiumCityIds);

const premiumCitiesPackage: RegionalPackage = {
  id: 'premium-cities',
  name: 'Luxury Markets',
  description: 'Scottsdale, North Scottsdale, Paradise Valley, Carefree & Cave Creek',
  includedCityIds: premiumCityIds,
  excludedPremiumCities: [],
  alaCarteTotal: premiumPrices.alaCarte,
  retailTotal: premiumPrices.retail,
  earlyAdopterPrice: premiumPrices.earlyAdopter,
  bundleSavings: premiumPrices.bundleSavings,
  isPremiumPackage: true,
};

// === EAST VALLEY PACKAGE ===
const eastValleyCities = [
  'mesa', 'chandler', 'gilbert', 'tempe', 'queen-creek', 
  'apache-junction', 'san-tan-valley', 'fountain-hills', 'sun-lakes'
];
const eastValleyPrices = calculateBundlePrice(eastValleyCities);

// === WEST VALLEY PACKAGE ===
const westValleyCities = [
  'glendale', 'peoria', 'surprise', 'goodyear', 'buckeye', 
  'avondale', 'litchfield-park', 'el-mirage', 'tolleson', 
  'youngtown', 'sun-city', 'sun-city-west'
];
const westValleyPrices = calculateBundlePrice(westValleyCities);

// === NORTH VALLEY PACKAGE ===
const northValleyCities = ['anthem', 'new-river'];
const northValleyPrices = calculateBundlePrice(northValleyCities);

// === CENTRAL PHOENIX CORRIDOR PACKAGE ===
const phoenixCentralCities = ['phoenix'];
const phoenixCentralPrices = calculateBundlePrice(phoenixCentralCities);

// === NORTHERN ARIZONA PACKAGE ===
const northernAZCities = ['sedona', 'flagstaff', 'prescott', 'prescott-valley'];
const northernAZPrices = calculateBundlePrice(northernAZCities);

// === SOUTH VALLEY PACKAGE ===
const southValleyCities = ['maricopa'];
const southValleyPrices = calculateBundlePrice(southValleyCities);

// === SOUTHERN ARIZONA PACKAGE (Tucson Area) ===
const southernAZCities = ['tucson', 'casa-grande', 'oro-valley', 'marana', 'green-valley', 'sierra-vista'];
const southernAZPrices = calculateBundlePrice(southernAZCities);

export const REGIONAL_PACKAGES: RegionalPackage[] = [
  // Premium/Luxury package first
  premiumCitiesPackage,
  
  // Regional packages
  {
    id: 'east-valley',
    name: 'East Valley',
    description: 'Mesa, Chandler, Gilbert, Tempe, Queen Creek & more',
    includedCityIds: eastValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: eastValleyPrices.alaCarte,
    retailTotal: eastValleyPrices.retail,
    earlyAdopterPrice: eastValleyPrices.earlyAdopter,
    bundleSavings: eastValleyPrices.bundleSavings,
  },
  {
    id: 'west-valley',
    name: 'West Valley',
    description: 'Glendale, Peoria, Surprise, Goodyear, Buckeye & more',
    includedCityIds: westValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: westValleyPrices.alaCarte,
    retailTotal: westValleyPrices.retail,
    earlyAdopterPrice: westValleyPrices.earlyAdopter,
    bundleSavings: westValleyPrices.bundleSavings,
  },
  {
    id: 'north-valley',
    name: 'North Valley',
    description: 'Anthem & New River (I-17 Corridor)',
    includedCityIds: northValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: northValleyPrices.alaCarte,
    retailTotal: northValleyPrices.retail,
    earlyAdopterPrice: northValleyPrices.earlyAdopter,
    bundleSavings: northValleyPrices.bundleSavings,
  },
  {
    id: 'central-phoenix-corridor',
    name: 'Central Phoenix Corridor',
    description: 'Phoenix Metro',
    includedCityIds: phoenixCentralCities,
    excludedPremiumCities: [],
    alaCarteTotal: phoenixCentralPrices.alaCarte,
    retailTotal: phoenixCentralPrices.retail,
    earlyAdopterPrice: phoenixCentralPrices.earlyAdopter,
    bundleSavings: phoenixCentralPrices.bundleSavings,
  },
  {
    id: 'northern-arizona',
    name: 'Northern Arizona',
    description: 'Sedona, Flagstaff, Prescott & Prescott Valley',
    includedCityIds: northernAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: northernAZPrices.alaCarte,
    retailTotal: northernAZPrices.retail,
    earlyAdopterPrice: northernAZPrices.earlyAdopter,
    bundleSavings: northernAZPrices.bundleSavings,
  },
  {
    id: 'south-valley',
    name: 'South Valley',
    description: 'Maricopa',
    includedCityIds: southValleyCities,
    excludedPremiumCities: [],
    alaCarteTotal: southValleyPrices.alaCarte,
    retailTotal: southValleyPrices.retail,
    earlyAdopterPrice: southValleyPrices.earlyAdopter,
    bundleSavings: southValleyPrices.bundleSavings,
  },
  {
    id: 'southern-arizona',
    name: 'Southern Arizona',
    description: 'Tucson, Casa Grande, Oro Valley, Marana, Green Valley & Sierra Vista',
    includedCityIds: southernAZCities,
    excludedPremiumCities: [],
    alaCarteTotal: southernAZPrices.alaCarte,
    retailTotal: southernAZPrices.retail,
    earlyAdopterPrice: southernAZPrices.earlyAdopter,
    bundleSavings: southernAZPrices.bundleSavings,
  },
];

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
  return premiumCitiesPackage;
}

// Get non-premium packages (regional only)
export function getRegionalPackages(): RegionalPackage[] {
  return REGIONAL_PACKAGES.filter(p => !p.isPremiumPackage);
}
