// Regional Package Definitions
// 3-month minimum commitment, billed monthly

import { ARIZONA_CITIES, CityPricingData, PREMIUM_CITIES } from './arizonaCityPricing';

export interface RegionalPackage {
  id: string;
  name: string;
  description: string;
  includedCityIds: string[];
  excludedPremiumCities: string[];
  retailTotal: number;
  earlyAdopterPrice: number;
  savings: number;
}

// Calculate package prices from included cities
function calculatePackagePrice(cityIds: string[]): { retail: number; earlyAdopter: number } {
  const cities = ARIZONA_CITIES.filter(c => cityIds.includes(c.id));
  const retail = cities.reduce((sum, c) => sum + c.retailPrice, 0);
  const earlyAdopter = cities.reduce((sum, c) => sum + c.earlyAdopterPrice, 0);
  return { retail, earlyAdopter };
}

// Phoenix Metro Package
const phoenixMetroCities = [
  'phoenix', 'mesa', 'tempe', 'chandler', 'gilbert', 
  'glendale', 'peoria', 'surprise', 'goodyear'
];
const phoenixMetroPrices = calculatePackagePrice(phoenixMetroCities);

// Northern Arizona Package
const northernAZCities = [
  'flagstaff', 'prescott', 'prescott-valley'
];
const northernAZPrices = calculatePackagePrice(northernAZCities);

// Southern Arizona Package
const southernAZCities = [
  'tucson', 'oro-valley', 'marana', 'green-valley', 'sierra-vista'
];
const southernAZPrices = calculatePackagePrice(southernAZCities);

export const REGIONAL_PACKAGES: RegionalPackage[] = [
  {
    id: 'phoenix-metro',
    name: 'Phoenix Metro Package',
    description: '9 cities covering Greater Phoenix, East Valley & West Valley',
    includedCityIds: phoenixMetroCities,
    excludedPremiumCities: ['paradise-valley', 'scottsdale', 'carefree', 'cave-creek'],
    retailTotal: phoenixMetroPrices.retail,
    earlyAdopterPrice: Math.round(phoenixMetroPrices.earlyAdopter * 0.85), // 15% package discount
    savings: phoenixMetroPrices.retail - Math.round(phoenixMetroPrices.earlyAdopter * 0.85),
  },
  {
    id: 'northern-arizona',
    name: 'Northern Arizona Package',
    description: '3 cities covering Flagstaff, Prescott & surrounds',
    includedCityIds: northernAZCities,
    excludedPremiumCities: ['sedona'],
    retailTotal: northernAZPrices.retail,
    earlyAdopterPrice: Math.round(northernAZPrices.earlyAdopter * 0.85),
    savings: northernAZPrices.retail - Math.round(northernAZPrices.earlyAdopter * 0.85),
  },
  {
    id: 'southern-arizona',
    name: 'Southern Arizona Package',
    description: '5 cities covering Tucson metro & southern communities',
    includedCityIds: southernAZCities,
    excludedPremiumCities: [],
    retailTotal: southernAZPrices.retail,
    earlyAdopterPrice: Math.round(southernAZPrices.earlyAdopter * 0.85),
    savings: southernAZPrices.retail - Math.round(southernAZPrices.earlyAdopter * 0.85),
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
