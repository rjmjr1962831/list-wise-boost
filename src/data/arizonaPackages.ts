// Regional Package Definitions
// 3-month minimum commitment, billed monthly

import { ARIZONA_CITIES, CityPricingData, PREMIUM_CITIES, Region } from './arizonaCityPricing';

export interface RegionalPackage {
  id: string;
  name: string;
  description: string;
  includedCityIds: string[];
  excludedPremiumCities: string[];
  retailTotal: number;
  earlyAdopterPrice: number;
  savings: number;
  isPremiumPackage?: boolean;
}

// Calculate package prices from included cities
function calculatePackagePrice(cityIds: string[]): { retail: number; earlyAdopter: number } {
  const cities = ARIZONA_CITIES.filter(c => cityIds.includes(c.id));
  const retail = cities.reduce((sum, c) => sum + c.retailPrice, 0);
  const earlyAdopter = cities.reduce((sum, c) => sum + c.earlyAdopterPrice, 0);
  return { retail, earlyAdopter };
}

// === PREMIUM CITIES PACKAGE ===
// Scottsdale, North Scottsdale, Paradise Valley, Carefree, Cave Creek
// Retail $999/mo, Early Adopter $499/mo
const premiumCitiesPackage: RegionalPackage = {
  id: 'premium-cities',
  name: 'Premium Cities',
  description: 'Scottsdale, North Scottsdale, Paradise Valley, Carefree & Cave Creek',
  includedCityIds: ['scottsdale', 'north-scottsdale', 'paradise-valley', 'carefree', 'cave-creek'],
  excludedPremiumCities: [],
  retailTotal: 999,
  earlyAdopterPrice: 499,
  savings: 500,
  isPremiumPackage: true,
};

// === EAST VALLEY PACKAGE ===
// Mesa, Chandler, Gilbert, Tempe, Queen Creek, Apache Junction, San Tan Valley, Fountain Hills, Sun Lakes
const eastValleyCities = [
  'mesa', 'chandler', 'gilbert', 'tempe', 'queen-creek', 
  'apache-junction', 'san-tan-valley', 'fountain-hills', 'sun-lakes'
];
const eastValleyPrices = calculatePackagePrice(eastValleyCities);

// === WEST VALLEY PACKAGE ===
// Glendale, Peoria, Surprise, Goodyear, Buckeye, Avondale, Litchfield Park, El Mirage, Tolleson, Youngtown, Sun City, Sun City West
const westValleyCities = [
  'glendale', 'peoria', 'surprise', 'goodyear', 'buckeye', 
  'avondale', 'litchfield-park', 'el-mirage', 'tolleson', 
  'youngtown', 'sun-city', 'sun-city-west'
];
const westValleyPrices = calculatePackagePrice(westValleyCities);

// === NORTH VALLEY PACKAGE ===
// Anthem, New River
const northValleyCities = ['anthem', 'new-river'];
const northValleyPrices = calculatePackagePrice(northValleyCities);

// === PHOENIX CENTRAL PACKAGE ===
// Phoenix, Maricopa, Casa Grande
const phoenixCentralCities = ['phoenix', 'maricopa', 'casa-grande'];
const phoenixCentralPrices = calculatePackagePrice(phoenixCentralCities);

// === NORTHERN ARIZONA PACKAGE ===
// Sedona, Flagstaff, Prescott, Prescott Valley
const northernAZCities = ['sedona', 'flagstaff', 'prescott', 'prescott-valley'];
const northernAZPrices = calculatePackagePrice(northernAZCities);

// === SOUTHERN ARIZONA PACKAGE ===
// Tucson, Oro Valley, Marana, Green Valley, Sierra Vista
const southernAZCities = ['tucson', 'oro-valley', 'marana', 'green-valley', 'sierra-vista'];
const southernAZPrices = calculatePackagePrice(southernAZCities);

export const REGIONAL_PACKAGES: RegionalPackage[] = [
  // Premium package first
  premiumCitiesPackage,
  
  // Regional packages
  {
    id: 'east-valley',
    name: 'East Valley',
    description: 'Mesa, Chandler, Gilbert, Tempe, Queen Creek & more',
    includedCityIds: eastValleyCities,
    excludedPremiumCities: [],
    retailTotal: eastValleyPrices.retail,
    earlyAdopterPrice: eastValleyPrices.earlyAdopter,
    savings: eastValleyPrices.retail - eastValleyPrices.earlyAdopter,
  },
  {
    id: 'west-valley',
    name: 'West Valley',
    description: 'Glendale, Peoria, Surprise, Goodyear, Buckeye & more',
    includedCityIds: westValleyCities,
    excludedPremiumCities: [],
    retailTotal: westValleyPrices.retail,
    earlyAdopterPrice: westValleyPrices.earlyAdopter,
    savings: westValleyPrices.retail - westValleyPrices.earlyAdopter,
  },
  {
    id: 'north-valley',
    name: 'North Valley',
    description: 'Anthem & New River (I-17 Corridor)',
    includedCityIds: northValleyCities,
    excludedPremiumCities: [],
    retailTotal: northValleyPrices.retail,
    earlyAdopterPrice: northValleyPrices.earlyAdopter,
    savings: northValleyPrices.retail - northValleyPrices.earlyAdopter,
  },
  {
    id: 'phoenix-central',
    name: 'Phoenix Central',
    description: 'Phoenix, Maricopa & Casa Grande',
    includedCityIds: phoenixCentralCities,
    excludedPremiumCities: [],
    retailTotal: phoenixCentralPrices.retail,
    earlyAdopterPrice: phoenixCentralPrices.earlyAdopter,
    savings: phoenixCentralPrices.retail - phoenixCentralPrices.earlyAdopter,
  },
  {
    id: 'northern-arizona',
    name: 'Northern Arizona',
    description: 'Sedona, Flagstaff, Prescott & Prescott Valley',
    includedCityIds: northernAZCities,
    excludedPremiumCities: [],
    retailTotal: northernAZPrices.retail,
    earlyAdopterPrice: northernAZPrices.earlyAdopter,
    savings: northernAZPrices.retail - northernAZPrices.earlyAdopter,
  },
  {
    id: 'southern-arizona',
    name: 'Southern Arizona',
    description: 'Tucson, Oro Valley, Marana, Green Valley & Sierra Vista',
    includedCityIds: southernAZCities,
    excludedPremiumCities: [],
    retailTotal: southernAZPrices.retail,
    earlyAdopterPrice: southernAZPrices.earlyAdopter,
    savings: southernAZPrices.retail - southernAZPrices.earlyAdopter,
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
