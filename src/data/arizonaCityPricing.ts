// Arizona City Pricing Data with Early Adopter Pricing
// 3-month minimum commitment, billed monthly
// Median home prices approximate as of December 2025

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
  medianHomePrice?: number;
  medianIncome?: number;
  marketDescription?: string;
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
  { id: 'scottsdale', cityName: 'Scottsdale', citySlug: 'scottsdale', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 600, earlyAdopterPrice: 300, spotsRemaining: 5, isPremium: true, medianHomePrice: 875000, marketDescription: "Known for luxury properties, golf communities, and upscale desert living" },
  { id: 'north-scottsdale', cityName: 'North Scottsdale', citySlug: 'north-scottsdale', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 600, earlyAdopterPrice: 300, spotsRemaining: 5, isPremium: true, medianHomePrice: 1200000, marketDescription: "Premier luxury enclave with custom estates, world-class golf, and mountain views" },
  { id: 'paradise-valley', cityName: 'Paradise Valley', citySlug: 'paradise-valley', region: 'Scottsdale Area', tier: 'Luxury', retailPrice: 800, earlyAdopterPrice: 400, spotsRemaining: 3, isPremium: true, medianHomePrice: 3200000, marketDescription: "Arizona's most exclusive enclave with multimillion-dollar estates" },
  { id: 'carefree', cityName: 'Carefree', citySlug: 'carefree', region: 'Scottsdale Area', tier: 'Premium', retailPrice: 400, earlyAdopterPrice: 200, spotsRemaining: 6, isPremium: true, medianHomePrice: 950000, marketDescription: "Upscale desert community with artistic heritage and Boulders Resort" },
  { id: 'cave-creek', cityName: 'Cave Creek', citySlug: 'cave-creek', region: 'Scottsdale Area', tier: 'Premium', retailPrice: 400, earlyAdopterPrice: 200, spotsRemaining: 6, isPremium: true, medianHomePrice: 795000, marketDescription: "Western-themed town with custom homes and desert horse properties" },
  
  // === EAST VALLEY ===
  { id: 'mesa', cityName: 'Mesa', citySlug: 'mesa', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 8, isPremium: false, medianHomePrice: 385000, marketDescription: "The third-largest city in Arizona offering affordable family homes and growing tech employment" },
  { id: 'chandler', cityName: 'Chandler', citySlug: 'chandler', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 7, isPremium: false, medianHomePrice: 475000, medianIncome: 85000, marketDescription: "A tech hub with Intel and other major employers, featuring master-planned communities" },
  { id: 'gilbert', cityName: 'Gilbert', citySlug: 'gilbert', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 6, isPremium: false, medianHomePrice: 495000, marketDescription: "One of America's fastest-growing towns with excellent schools and family-oriented communities" },
  { id: 'tempe', cityName: 'Tempe', citySlug: 'tempe', region: 'East Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 9, isPremium: false, medianHomePrice: 445000, medianIncome: 92000, marketDescription: "Home to Arizona State University with a vibrant urban core and diverse housing" },
  { id: 'queen-creek', cityName: 'Queen Creek', citySlug: 'queen-creek', region: 'East Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 525000, marketDescription: "Rural charm meets suburban growth with equestrian properties and new developments" },
  { id: 'apache-junction', cityName: 'Apache Junction', citySlug: 'apache-junction', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 335000, marketDescription: "Gateway to the Superstition Mountains with affordable desert living" },
  { id: 'san-tan-valley', cityName: 'San Tan Valley', citySlug: 'san-tan-valley', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 385000, marketDescription: "Fast-growing affordable community between Phoenix and Tucson metros" },
  { id: 'fountain-hills', cityName: 'Fountain Hills', citySlug: 'fountain-hills', region: 'East Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 625000, marketDescription: "Known for its famous fountain, mountain views, and artistic community" },
  { id: 'sun-lakes', cityName: 'Sun Lakes', citySlug: 'sun-lakes', region: 'East Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Active adult community with golf courses and resort-style amenities" },
  
  // === WEST VALLEY ===
  { id: 'glendale', cityName: 'Glendale', citySlug: 'glendale', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false, medianHomePrice: 365000, marketDescription: "Home to State Farm Stadium and Westgate, with affordable housing options" },
  { id: 'peoria', cityName: 'Peoria', citySlug: 'peoria', region: 'West Valley', tier: 'Suburban', retailPrice: 250, earlyAdopterPrice: 125, spotsRemaining: 10, isPremium: false, medianHomePrice: 420000, marketDescription: "Spring training destination with lake access and master-planned communities" },
  { id: 'surprise', cityName: 'Surprise', citySlug: 'surprise', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 395000, marketDescription: "Fast-growing city with affordable new construction and active adult communities" },
  { id: 'goodyear', cityName: 'Goodyear', citySlug: 'goodyear', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 445000, marketDescription: "West Valley growth leader with new development and spring training facilities" },
  { id: 'buckeye', cityName: 'Buckeye', citySlug: 'buckeye', region: 'West Valley', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 385000, marketDescription: "One of America's fastest-growing cities with extensive new home construction" },
  { id: 'avondale', cityName: 'Avondale', citySlug: 'avondale', region: 'West Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 365000, marketDescription: "Affordable West Valley option near Phoenix International Raceway" },
  { id: 'litchfield-park', cityName: 'Litchfield Park', citySlug: 'litchfield-park', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 525000, marketDescription: "Historic planned community with Wigwam Resort and tree-lined streets" },
  { id: 'el-mirage', cityName: 'El Mirage', citySlug: 'el-mirage', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 295000, marketDescription: "Affordable West Valley community with easy highway access" },
  { id: 'tolleson', cityName: 'Tolleson', citySlug: 'tolleson', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 285000, marketDescription: "Small community with affordable housing near downtown Phoenix" },
  { id: 'youngtown', cityName: 'Youngtown', citySlug: 'youngtown', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 265000, marketDescription: "America's first age-restricted retirement community" },
  { id: 'sun-city', cityName: 'Sun City', citySlug: 'sun-city', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 295000, marketDescription: "Pioneering active adult community with golf and recreation" },
  { id: 'sun-city-west', cityName: 'Sun City West', citySlug: 'sun-city-west', region: 'West Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 325000, marketDescription: "Expanded active adult community with enhanced amenities" },
  
  // === NORTH VALLEY ===
  { id: 'anthem', cityName: 'Anthem', citySlug: 'anthem', region: 'North Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 545000, marketDescription: "Master-planned community with extensive amenities and community parks" },
  { id: 'new-river', cityName: 'New River', citySlug: 'new-river', region: 'North Valley', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 485000, marketDescription: "Rural desert living with larger lots and mountain views" },
  
  // === PHOENIX CENTRAL ===
  { id: 'phoenix', cityName: 'Phoenix', citySlug: 'phoenix', region: 'Phoenix Central', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 175, spotsRemaining: 8, isPremium: false, medianHomePrice: 425000, marketDescription: "Arizona's capital and largest city with a diverse housing market ranging from urban condos to sprawling desert estates" },
  { id: 'maricopa', cityName: 'Maricopa', citySlug: 'maricopa', region: 'Phoenix Central', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 335000, marketDescription: "Master-planned community living with affordable new construction" },
  { id: 'casa-grande', cityName: 'Casa Grande', citySlug: 'casa-grande', region: 'Phoenix Central', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 295000, marketDescription: "Affordable alternative between Phoenix and Tucson with growing employment" },
  
  // === NORTHERN ARIZONA ===
  { id: 'sedona', cityName: 'Sedona', citySlug: 'sedona', region: 'Northern Arizona', tier: 'Premium', retailPrice: 500, earlyAdopterPrice: 250, spotsRemaining: 4, isPremium: false, medianHomePrice: 875000, marketDescription: "World-famous red rock destination with luxury and vacation properties" },
  { id: 'flagstaff', cityName: 'Flagstaff', citySlug: 'flagstaff', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 595000, marketDescription: "Mountain resort town with Northern Arizona University and four-season lifestyle" },
  { id: 'prescott', cityName: 'Prescott', citySlug: 'prescott', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 545000, marketDescription: "Historic mountain town with four seasons and vibrant downtown" },
  { id: 'prescott-valley', cityName: 'Prescott Valley', citySlug: 'prescott-valley', region: 'Northern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Affordable mountain living near Prescott with growing amenities" },
  { id: 'cottonwood', cityName: 'Cottonwood', citySlug: 'cottonwood', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Verde Valley hub near wine country and historic Jerome" },
  { id: 'payson', cityName: 'Payson', citySlug: 'payson', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Rim Country escape with pine forests and cooler temperatures" },
  { id: 'show-low', cityName: 'Show Low', citySlug: 'show-low', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 365000, marketDescription: "White Mountains hub with outdoor recreation and affordable mountain living" },
  { id: 'pinetop-lakeside', cityName: 'Pinetop-Lakeside', citySlug: 'pinetop-lakeside', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 395000, marketDescription: "Popular mountain retreat with cabin living and winter activities" },
  { id: 'lake-havasu-city', cityName: 'Lake Havasu City', citySlug: 'lake-havasu-city', region: 'Northern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Waterfront desert living on Lake Havasu with London Bridge" },
  { id: 'kingman', cityName: 'Kingman', citySlug: 'kingman', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 295000, marketDescription: "Route 66 heritage city with affordable housing and desert mountain scenery" },
  { id: 'bullhead-city', cityName: 'Bullhead City', citySlug: 'bullhead-city', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 325000, marketDescription: "Colorado River community across from Laughlin casinos" },
  
  // === SOUTHERN ARIZONA ===
  { id: 'tucson', cityName: 'Tucson', citySlug: 'tucson', region: 'Southern Arizona', tier: 'Major Market', retailPrice: 350, earlyAdopterPrice: 175, spotsRemaining: 10, isPremium: false, medianHomePrice: 325000, marketDescription: "Arizona's second-largest city with rich cultural heritage and University of Arizona" },
  { id: 'oro-valley', cityName: 'Oro Valley', citySlug: 'oro-valley', region: 'Southern Arizona', tier: 'Growth', retailPrice: 175, earlyAdopterPrice: 88, spotsRemaining: 10, isPremium: false, medianHomePrice: 485000, marketDescription: "Tucson's upscale suburb with mountain views and excellent schools" },
  { id: 'marana', cityName: 'Marana', citySlug: 'marana', region: 'Southern Arizona', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 385000, marketDescription: "Fast-growing Tucson suburb with new development and Ritz-Carlton Dove Mountain" },
  { id: 'green-valley', cityName: 'Green Valley', citySlug: 'green-valley', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 285000, marketDescription: "Active adult community south of Tucson with mild winters" },
  { id: 'sierra-vista', cityName: 'Sierra Vista', citySlug: 'sierra-vista', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 275000, marketDescription: "Gateway to Fort Huachuca with affordable mountain views" },
  { id: 'yuma', cityName: 'Yuma', citySlug: 'yuma', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 295000, marketDescription: "Affordable border city with agricultural heritage and military presence" },
  { id: 'nogales', cityName: 'Nogales', citySlug: 'nogales', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 215000, marketDescription: "Border city with rich cultural heritage and affordable homes" },
  { id: 'florence', cityName: 'Florence', citySlug: 'florence', region: 'Southern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 345000, marketDescription: "Historic Arizona town with new development and Anthem at Merrill Ranch" },
  { id: 'gold-canyon', cityName: 'Gold Canyon', citySlug: 'gold-canyon', region: 'East Valley', tier: 'Emerging', retailPrice: 125, earlyAdopterPrice: 63, spotsRemaining: 10, isPremium: false, medianHomePrice: 425000, marketDescription: "Golf community at the base of the Superstition Mountains" },
  { id: 'wickenburg', cityName: 'Wickenburg', citySlug: 'wickenburg', region: 'Northern Arizona', tier: 'Entry', retailPrice: 100, earlyAdopterPrice: 50, spotsRemaining: 10, isPremium: false, medianHomePrice: 395000, marketDescription: "Historic Western town with dude ranches and artistic heritage" },
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

// Get city by slug
export function getCityBySlug(slug: string): CityPricingData | undefined {
  return ARIZONA_CITIES.find(city => city.citySlug === slug);
}

// Format price for display
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(price);
}

// Constants for statewide stats
export const ARIZONA_TOTAL_LICENSED_AGENTS = 220000;
export const QUALIFICATION_THRESHOLD_PERCENT = 0.2;
