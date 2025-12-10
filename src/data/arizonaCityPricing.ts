// Arizona City Pricing Data with Early Adopter Pricing
// 3-month minimum commitment, billed monthly

export type PricingTier = 'Luxury' | 'Premium' | 'Major Market' | 'Suburban' | 'Growth' | 'Emerging' | 'Entry';

export type Region = 'East Valley' | 'West Valley' | 'North Valley' | 'Scottsdale Area' | 'Phoenix Central' | 'Northern Arizona' | 'Southern Arizona';

export interface CityPricingData {
  id: string;
  cityName: string;
  citySlug: string;
  region: Region;
  tier: PricingTier;
  retailPrice: number;
  earlyAdopterPrice: number;
  spotsRemaining: number;
  isPremium: boolean;
}

// Pricing tiers with retail and early adopter prices (early adopter = 50% of retail)
export const TIER_PRICING: Record<PricingTier, { retail: number; earlyAdopter: number }> = {
  'Luxury': { retail: 750, earlyAdopter: 375 },
  'Premium': { retail: 500, earlyAdopter: 250 },
  'Major Market': { retail: 350, earlyAdopter: 175 },
  'Suburban': { retail: 250, earlyAdopter: 125 },
  'Growth': { retail: 175, earlyAdopter: 88 },
  'Emerging': { retail: 125, earlyAdopter: 63 },
  'Entry': { retail: 100, earlyAdopter: 50 },
};

// Premium package cities (Scottsdale, North Scottsdale, Paradise Valley, Carefree, Cave Creek)
export const PREMIUM_CITIES = ['scottsdale', 'north-scottsdale', 'paradise-valley', 'carefree', 'cave-creek'];

export const ARIZONA_CITIES: CityPricingData[] = [
  // === PREMIUM CITIES (Luxury Package) ===
  // Scottsdale & North Scottsdale: $600 retail, Paradise Valley: $800 retail
  { id: 'scottsdale', cityName: 'Scottsdale', citySlug: 'scottsdale', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 600, earlyAdopterPrice: 300, spotsRemaining: 5, isPremium: true },
  { id: 'north-scottsdale', cityName: 'North Scottsdale', citySlug: 'north-scottsdale', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 600, earlyAdopterPrice: 300, spotsRemaining: 5, isPremium: true },
  { id: 'paradise-valley', cityName: 'Paradise Valley', citySlug: 'paradise-valley', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 800, earlyAdopterPrice: 400, spotsRemaining: 3, isPremium: true },
  { id: 'carefree', cityName: 'Carefree', citySlug: 'carefree', region: 'Scottsdale Area', tier: 'Premium', retailPrice: 400, earlyAdopterPrice: 200, spotsRemaining: 6, isPremium: true },
  { id: 'cave-creek', cityName: 'Cave Creek', citySlug: 'cave-creek', region: 'Scottsdale Area', tier: 'Premium', retailPrice: 400, earlyAdopterPrice: 200, spotsRemaining: 6, isPremium: true },
  
  // === EAST VALLEY === (per TripSavvy: Mesa, Chandler, Gilbert, Tempe, Queen Creek, Apache Junction, Sun Lakes, Fountain Hills)
  { id: 'mesa', cityName: 'Mesa', citySlug: 'mesa', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 8, isPremium: false },
  { id: 'chandler', cityName: 'Chandler', citySlug: 'chandler', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 7, isPremium: false },
  { id: 'gilbert', cityName: 'Gilbert', citySlug: 'gilbert', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 6, isPremium: false },
  { id: 'tempe', cityName: 'Tempe', citySlug: 'tempe', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 9, isPremium: false },
  { id: 'queen-creek', cityName: 'Queen Creek', citySlug: 'queen-creek', region: 'East Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'apache-junction', cityName: 'Apache Junction', citySlug: 'apache-junction', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'san-tan-valley', cityName: 'San Tan Valley', citySlug: 'san-tan-valley', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'fountain-hills', cityName: 'Fountain Hills', citySlug: 'fountain-hills', region: 'East Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false },
  { id: 'sun-lakes', cityName: 'Sun Lakes', citySlug: 'sun-lakes', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  
  // === WEST VALLEY === (per TripSavvy: Glendale, Peoria, Surprise, Goodyear, Buckeye, Avondale, Litchfield Park, El Mirage, Tolleson, Youngtown, Sun City, Sun City West)
  { id: 'glendale', cityName: 'Glendale', citySlug: 'glendale', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'peoria', cityName: 'Peoria', citySlug: 'peoria', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false },
  { id: 'surprise', cityName: 'Surprise', citySlug: 'surprise', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'goodyear', cityName: 'Goodyear', citySlug: 'goodyear', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'buckeye', cityName: 'Buckeye', citySlug: 'buckeye', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'avondale', cityName: 'Avondale', citySlug: 'avondale', region: 'West Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false },
  { id: 'litchfield-park', cityName: 'Litchfield Park', citySlug: 'litchfield-park', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'el-mirage', cityName: 'El Mirage', citySlug: 'el-mirage', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'tolleson', cityName: 'Tolleson', citySlug: 'tolleson', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'youngtown', cityName: 'Youngtown', citySlug: 'youngtown', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'sun-city', cityName: 'Sun City', citySlug: 'sun-city', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'sun-city-west', cityName: 'Sun City West', citySlug: 'sun-city-west', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  
  // === NORTH VALLEY === (I-17 Corridor: Anthem, New River)
  { id: 'anthem', cityName: 'Anthem', citySlug: 'anthem', region: 'North Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false },
  { id: 'new-river', cityName: 'New River', citySlug: 'new-river', region: 'North Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  
  // === PHOENIX CENTRAL ===
  { id: 'phoenix', cityName: 'Phoenix', citySlug: 'phoenix', region: 'Phoenix Central', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 175, spotsRemaining: 8, isPremium: false },
  { id: 'maricopa', cityName: 'Maricopa', citySlug: 'maricopa', region: 'Phoenix Central', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'casa-grande', cityName: 'Casa Grande', citySlug: 'casa-grande', region: 'Phoenix Central', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  
  // === NORTHERN ARIZONA ===
  { id: 'sedona', cityName: 'Sedona', citySlug: 'sedona', region: 'Northern Arizona', tier: 'Premium', retailPrice: 500, earlyAdopterPrice: 250, spotsRemaining: 4, isPremium: false },
  { id: 'flagstaff', cityName: 'Flagstaff', citySlug: 'flagstaff', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'prescott', cityName: 'Prescott', citySlug: 'prescott', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'prescott-valley', cityName: 'Prescott Valley', citySlug: 'prescott-valley', region: 'Northern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false },
  
  // === SOUTHERN ARIZONA ===
  { id: 'tucson', cityName: 'Tucson', citySlug: 'tucson', region: 'Southern Arizona', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 175, spotsRemaining: 10, isPremium: false },
  { id: 'oro-valley', cityName: 'Oro Valley', citySlug: 'oro-valley', region: 'Southern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false },
  { id: 'marana', cityName: 'Marana', citySlug: 'marana', region: 'Southern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false },
  { id: 'green-valley', cityName: 'Green Valley', citySlug: 'green-valley', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
  { id: 'sierra-vista', cityName: 'Sierra Vista', citySlug: 'sierra-vista', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false },
];

// Get cities by region
export function getCitiesByRegion(region: Region): CityPricingData[] {
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
