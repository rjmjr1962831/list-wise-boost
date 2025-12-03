// Arizona City Pricing Data with Early Adopter Pricing
// 3-month minimum commitment, billed monthly

export type PricingTier = 'Luxury' | 'Premium' | 'Major Market' | 'Suburban' | 'Growth' | 'Emerging' | 'Entry';

export interface CityPricingData {
  id: string;
  cityName: string;
  citySlug: string;
  region: 'Phoenix Metro' | 'East Valley' | 'West Valley' | 'Northern Arizona' | 'Southern Arizona';
  tier: PricingTier;
  retailPrice: number;
  earlyAdopterPrice: number;
  spotsRemaining: number;
  isPremium: boolean;
}

// Pricing tiers with retail and early adopter prices
export const TIER_PRICING: Record<PricingTier, { retail: number; earlyAdopter: number }> = {
  'Luxury': { retail: 750, earlyAdopter: 500 },
  'Premium': { retail: 500, earlyAdopter: 350 },
  'Major Market': { retail: 350, earlyAdopter: 250 },
  'Suburban': { retail: 250, earlyAdopter: 175 },
  'Growth': { retail: 175, earlyAdopter: 125 },
  'Emerging': { retail: 125, earlyAdopter: 100 },
  'Entry': { retail: 100, earlyAdopter: 75 },
};

// Premium add-on cities (excluded from packages)
export const PREMIUM_CITIES = ['paradise-valley', 'scottsdale', 'sedona', 'carefree'];

export const ARIZONA_CITIES: CityPricingData[] = [
  // Luxury Tier
  { id: 'paradise-valley', cityName: 'Paradise Valley', citySlug: 'paradise-valley', region: 'Phoenix Metro', tier: 'Luxury', retailPrice: 750, earlyAdopterPrice: 500, spotsRemaining: 3, isPremium: true },
  
  // Premium Tier
  { id: 'scottsdale', cityName: 'Scottsdale', citySlug: 'scottsdale', region: 'Phoenix Metro', tier: 'Premium', retailPrice: 500, earlyAdopterPrice: 350, spotsRemaining: 5, isPremium: true },
  { id: 'sedona', cityName: 'Sedona', citySlug: 'sedona', region: 'Northern Arizona', tier: 'Premium', retailPrice: 500, earlyAdopterPrice: 350, spotsRemaining: 4, isPremium: true },
  { id: 'carefree', cityName: 'Carefree', citySlug: 'carefree', region: 'Phoenix Metro', tier: 'Premium', retailPrice: 500, earlyAdopterPrice: 350, spotsRemaining: 6, isPremium: true },
  
  // Major Market Tier
  { id: 'phoenix', cityName: 'Phoenix', citySlug: 'phoenix', region: 'Phoenix Metro', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 250, spotsRemaining: 8, isPremium: false },
  { id: 'tucson', cityName: 'Tucson', citySlug: 'tucson', region: 'Southern Arizona', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 250, spotsRemaining: 10, isPremium: false },
  
  // Suburban Tier
  { id: 'mesa', cityName: 'Mesa', citySlug: 'mesa', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 8, isPremium: false },
  { id: 'chandler', cityName: 'Chandler', citySlug: 'chandler', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 7, isPremium: false },
  { id: 'gilbert', cityName: 'Gilbert', citySlug: 'gilbert', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 6, isPremium: false },
  { id: 'tempe', cityName: 'Tempe', citySlug: 'tempe', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 9, isPremium: false },
  { id: 'glendale', cityName: 'Glendale', citySlug: 'glendale', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 10, isPremium: false },
  { id: 'peoria', cityName: 'Peoria', citySlug: 'peoria', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 175, spotsRemaining: 10, isPremium: false },
  
  // Growth Tier
  { id: 'surprise', cityName: 'Surprise', citySlug: 'surprise', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'goodyear', cityName: 'Goodyear', citySlug: 'goodyear', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'buckeye', cityName: 'Buckeye', citySlug: 'buckeye', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'queen-creek', cityName: 'Queen Creek', citySlug: 'queen-creek', region: 'East Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'maricopa', cityName: 'Maricopa', citySlug: 'maricopa', region: 'Phoenix Metro', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'flagstaff', cityName: 'Flagstaff', citySlug: 'flagstaff', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'prescott', cityName: 'Prescott', citySlug: 'prescott', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'oro-valley', cityName: 'Oro Valley', citySlug: 'oro-valley', region: 'Southern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  
  // Emerging Tier
  { id: 'avondale', cityName: 'Avondale', citySlug: 'avondale', region: 'West Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 100, spotsRemaining: 10, isPremium: false },
  { id: 'fountain-hills', cityName: 'Fountain Hills', citySlug: 'fountain-hills', region: 'East Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 100, spotsRemaining: 10, isPremium: false },
  { id: 'cave-creek', cityName: 'Cave Creek', citySlug: 'cave-creek', region: 'Phoenix Metro', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 100, spotsRemaining: 10, isPremium: false },
  { id: 'prescott-valley', cityName: 'Prescott Valley', citySlug: 'prescott-valley', region: 'Northern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 100, spotsRemaining: 10, isPremium: false },
  { id: 'marana', cityName: 'Marana', citySlug: 'marana', region: 'Southern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 100, spotsRemaining: 10, isPremium: false },
  
  // Entry Tier
  { id: 'casa-grande', cityName: 'Casa Grande', citySlug: 'casa-grande', region: 'Phoenix Metro', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'san-tan-valley', cityName: 'San Tan Valley', citySlug: 'san-tan-valley', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'apache-junction', cityName: 'Apache Junction', citySlug: 'apache-junction', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'el-mirage', cityName: 'El Mirage', citySlug: 'el-mirage', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'litchfield-park', cityName: 'Litchfield Park', citySlug: 'litchfield-park', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'tolleson', cityName: 'Tolleson', citySlug: 'tolleson', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'youngtown', cityName: 'Youngtown', citySlug: 'youngtown', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'green-valley', cityName: 'Green Valley', citySlug: 'green-valley', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
  { id: 'sierra-vista', cityName: 'Sierra Vista', citySlug: 'sierra-vista', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 75, spotsRemaining: 10, isPremium: false },
];

// Get cities by region
export function getCitiesByRegion(region: CityPricingData['region']): CityPricingData[] {
  return ARIZONA_CITIES.filter(city => city.region === region && !city.isPremium);
}

// Get premium cities
export function getPremiumCities(): CityPricingData[] {
  return ARIZONA_CITIES.filter(city => city.isPremium);
}

// Get non-premium cities
export function getNonPremiumCities(): CityPricingData[] {
  return ARIZONA_CITIES.filter(city => !city.isPremium);
}
