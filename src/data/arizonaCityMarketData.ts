// Enhanced city market data for SEO and LLM optimization
// This data is displayed to bots/crawlers instead of individual agent information

export interface CityMarketData {
  slug: string;
  name: string;
  population?: number;
  medianHouseholdIncome?: number;
  medianHomePrice?: number;
  averageHomePrice?: number;
  pricePerSqFt?: number;
  homeAppreciation1Yr?: number;
  daysOnMarket?: number;
  overview: string;
  highlights: string[];
  neighborhoodTypes: string[];
  buyerProfile: string;
  marketTrends: string;
  // Enhanced fields for richer city guides
  historicalFacts?: string[];
  pointsOfInterest?: string[];
  localCulture?: string;
  bestKeptSecret?: string;
}

export const ARIZONA_CITY_MARKET_DATA: CityMarketData[] = [
  {
    slug: 'scottsdale',
    name: 'Scottsdale',
    population: 241361,
    medianHouseholdIncome: 98500,
    medianHomePrice: 875000,
    averageHomePrice: 1250000,
    pricePerSqFt: 425,
    homeAppreciation1Yr: 4.2,
    daysOnMarket: 52,
    overview: 'Scottsdale is renowned for luxury living, world-class golf courses, and a vibrant arts scene. The city attracts affluent buyers seeking resort-style amenities and upscale desert properties.',
    highlights: [
      'Over 200 golf courses in the greater Scottsdale area',
      'Home to the Scottsdale Arts District and Museum of the West',
      'Top-rated school districts including Scottsdale Unified',
      'Major employers include CVS Health, Vanguard, and Mayo Clinic'
    ],
    neighborhoodTypes: ['Luxury estates', 'Golf communities', 'High-rise condos', 'Custom desert homes'],
    buyerProfile: 'Luxury home buyers, retirees, second-home purchasers, and professionals in healthcare and finance',
    marketTrends: 'The Scottsdale market remains competitive with limited inventory in premium neighborhoods. Luxury properties above $2M continue to attract out-of-state buyers from California and the Northeast.'
  },
  {
    slug: 'phoenix',
    name: 'Phoenix',
    population: 1660272,
    medianHouseholdIncome: 65000,
    medianHomePrice: 425000,
    averageHomePrice: 485000,
    pricePerSqFt: 265,
    homeAppreciation1Yr: 3.8,
    daysOnMarket: 38,
    overview: 'Phoenix is Arizona\'s capital and the fifth-largest city in the United States. The diverse housing market ranges from urban condos downtown to sprawling desert estates in North Phoenix.',
    highlights: [
      'Strong job market with major employers including Banner Health, Intel, and State Farm',
      'Light rail connects downtown to Tempe and Mesa',
      'Year-round sunshine with 299 sunny days annually',
      'Professional sports teams: Suns, Cardinals, Diamondbacks, Coyotes'
    ],
    neighborhoodTypes: ['Downtown urban', 'Historic districts', 'Suburban family communities', 'Desert mountain estates'],
    buyerProfile: 'First-time buyers, growing families, young professionals, and remote workers relocating from higher-cost markets',
    marketTrends: 'Phoenix continues to attract significant migration from California and other high-cost states. The market has stabilized after rapid appreciation, with inventory slowly increasing.'
  },
  {
    slug: 'mesa',
    name: 'Mesa',
    population: 518012,
    medianHouseholdIncome: 62000,
    medianHomePrice: 385000,
    averageHomePrice: 425000,
    pricePerSqFt: 235,
    homeAppreciation1Yr: 3.5,
    daysOnMarket: 35,
    overview: 'Mesa is Arizona\'s third-largest city, offering affordable family homes, excellent schools, and growing tech employment. The city provides a balance of urban amenities and suburban lifestyle.',
    highlights: [
      'Home to Mesa Arts Center, one of the largest arts complexes in the Southwest',
      'Spring training home for the Chicago Cubs and Oakland Athletics',
      'Banner Desert Medical Center provides major healthcare employment',
      'Arizona State University Polytechnic campus drives tech innovation'
    ],
    neighborhoodTypes: ['Established neighborhoods', 'New master-planned communities', 'Active adult communities', 'Rural horse properties'],
    buyerProfile: 'First-time buyers, families seeking affordability, retirees, and healthcare workers',
    marketTrends: 'Mesa offers strong value compared to neighboring Scottsdale and Gilbert. New construction in southeast Mesa provides options for buyers priced out of more expensive East Valley cities.'
  },
  {
    slug: 'chandler',
    name: 'Chandler',
    population: 275987,
    medianHouseholdIncome: 85000,
    medianHomePrice: 475000,
    averageHomePrice: 525000,
    pricePerSqFt: 275,
    homeAppreciation1Yr: 4.0,
    daysOnMarket: 42,
    overview: 'Chandler is a tech hub home to Intel\'s major semiconductor facilities and numerous Fortune 500 companies. The city features excellent schools, master-planned communities, and a vibrant downtown.',
    highlights: [
      'Intel\'s largest manufacturing site employs over 12,000 people',
      'Top-rated Chandler Unified School District',
      'Downtown Chandler offers dining, entertainment, and farmers markets',
      'Home to multiple data centers including Microsoft and Apple'
    ],
    neighborhoodTypes: ['Master-planned communities', 'Tech corridor condos', 'Single-family suburbs', 'Golf communities'],
    buyerProfile: 'Tech professionals, families prioritizing education, and employees of major corporations',
    marketTrends: 'The tech industry continues to drive demand in Chandler. Homes near top-rated schools command premium prices, and the market remains competitive for well-maintained properties.'
  },
  {
    slug: 'gilbert',
    name: 'Gilbert',
    population: 267918,
    medianHouseholdIncome: 95000,
    medianHomePrice: 495000,
    averageHomePrice: 545000,
    pricePerSqFt: 255,
    homeAppreciation1Yr: 3.9,
    daysOnMarket: 40,
    overview: 'Gilbert consistently ranks among America\'s safest and best places to live. The town offers exceptional schools, family-oriented master-planned communities, and a charming heritage district.',
    highlights: [
      'Named one of America\'s safest cities for over a decade',
      'Gilbert Public Schools consistently rated A+ by Niche',
      'Heritage District offers boutique shopping and farm-to-table dining',
      'Numerous parks, trails, and recreational facilities'
    ],
    neighborhoodTypes: ['Family master-planned communities', 'Heritage district homes', 'New construction developments', 'Estate lots'],
    buyerProfile: 'Families with school-age children, professionals seeking work-life balance, and buyers prioritizing safety',
    marketTrends: 'Gilbert remains one of the most competitive markets in the Phoenix metro. Homes in top school zones sell quickly, and new construction cannot keep pace with demand.'
  },
  {
    slug: 'tempe',
    name: 'Tempe',
    population: 180587,
    medianHouseholdIncome: 58000,
    medianHomePrice: 445000,
    averageHomePrice: 495000,
    pricePerSqFt: 295,
    homeAppreciation1Yr: 3.6,
    daysOnMarket: 32,
    overview: 'Tempe is home to Arizona State University and offers a vibrant urban lifestyle. The city features diverse housing from high-rise condos to established neighborhoods, with excellent public transit connections.',
    highlights: [
      'Arizona State University drives innovation and employment',
      'Tempe Town Lake offers waterfront recreation and events',
      'Mill Avenue District provides dining, shopping, and nightlife',
      'Light rail connects to Phoenix, Mesa, and Sky Harbor Airport'
    ],
    neighborhoodTypes: ['Urban high-rises', 'University-area condos', 'Established family neighborhoods', 'Lakefront properties'],
    buyerProfile: 'Young professionals, investors, ASU faculty and staff, and urban lifestyle seekers',
    marketTrends: 'The Tempe market benefits from limited land availability and strong rental demand near ASU. Investor activity remains high, particularly for properties within walking distance of campus.'
  },
  {
    slug: 'paradise-valley',
    name: 'Paradise Valley',
    population: 14502,
    medianHouseholdIncome: 250000,
    medianHomePrice: 3200000,
    averageHomePrice: 4500000,
    pricePerSqFt: 650,
    homeAppreciation1Yr: 5.1,
    daysOnMarket: 95,
    overview: 'Paradise Valley is Arizona\'s most exclusive residential enclave, featuring multimillion-dollar estates, world-renowned resorts, and unparalleled privacy. The town has no commercial development by design.',
    highlights: [
      'Home to the Phoenician, Sanctuary, and Mountain Shadows resorts',
      'No commercial development preserves residential character',
      'Camelback Mountain provides iconic views and hiking',
      'Minimum one-acre lot sizes ensure privacy and exclusivity'
    ],
    neighborhoodTypes: ['Custom estates', 'Resort-adjacent properties', 'Historic mid-century modern homes', 'Gated compounds'],
    buyerProfile: 'Ultra-high-net-worth individuals, executives, celebrities, and international buyers',
    marketTrends: 'Paradise Valley remains the premier luxury market in Arizona. Properties above $10M attract cash buyers from California, New York, and international markets seeking privacy and tax advantages.'
  },
  {
    slug: 'tucson',
    name: 'Tucson',
    population: 546574,
    medianHouseholdIncome: 48000,
    medianHomePrice: 325000,
    averageHomePrice: 365000,
    pricePerSqFt: 195,
    homeAppreciation1Yr: 2.8,
    daysOnMarket: 45,
    overview: 'Tucson offers a rich cultural heritage, world-class University of Arizona, and more affordable living than Phoenix. The city features diverse architecture from historic adobes to modern desert homes.',
    highlights: [
      'University of Arizona drives research and employment',
      'Rich cultural heritage with Spanish colonial and Native American influences',
      'Saguaro National Park flanks the city east and west',
      'Lower cost of living than Phoenix with similar amenities'
    ],
    neighborhoodTypes: ['Historic districts', 'Foothills estates', 'University-area condos', 'Desert mountain communities'],
    buyerProfile: 'Retirees, university faculty, first-time buyers, and buyers seeking affordability with cultural amenities',
    marketTrends: 'Tucson offers significant value compared to Phoenix, attracting remote workers and retirees. The foothills communities remain desirable for buyers seeking mountain views and larger lots.'
  },
  {
    slug: 'sedona',
    name: 'Sedona',
    population: 10336,
    medianHouseholdIncome: 72000,
    medianHomePrice: 875000,
    averageHomePrice: 1150000,
    pricePerSqFt: 425,
    homeAppreciation1Yr: 4.5,
    daysOnMarket: 68,
    overview: 'Sedona is world-famous for its stunning red rock formations, spiritual retreats, and thriving arts community. The town attracts buyers seeking natural beauty and a wellness-focused lifestyle.',
    highlights: [
      'Iconic red rock formations draw millions of visitors annually',
      'Major art gallery destination with over 80 galleries',
      'Known as a spiritual and wellness destination',
      'Mild four-season climate at 4,500 feet elevation'
    ],
    neighborhoodTypes: ['Red rock view homes', 'Creekside properties', 'Golf communities', 'Spiritual retreat properties'],
    buyerProfile: 'Second-home buyers, retirees, wellness practitioners, and artists',
    marketTrends: 'Sedona inventory remains limited due to national forest boundaries restricting development. Homes with red rock views command significant premiums, and vacation rental potential influences buyer decisions.'
  },
  {
    slug: 'flagstaff',
    name: 'Flagstaff',
    population: 76831,
    medianHouseholdIncome: 58000,
    medianHomePrice: 595000,
    averageHomePrice: 650000,
    pricePerSqFt: 335,
    homeAppreciation1Yr: 3.2,
    daysOnMarket: 55,
    overview: 'Flagstaff offers a four-season mountain lifestyle at 7,000 feet elevation. Home to Northern Arizona University, the city attracts outdoor enthusiasts and those seeking escape from desert heat.',
    highlights: [
      'True four-season climate with skiing at Arizona Snowbowl',
      'Northern Arizona University drives economy and culture',
      'Historic Route 66 downtown with local shops and restaurants',
      'Gateway to Grand Canyon National Park'
    ],
    neighborhoodTypes: ['Mountain cabins', 'University-area homes', 'Historic downtown properties', 'Luxury pine communities'],
    buyerProfile: 'Outdoor enthusiasts, university faculty, remote workers, and second-home buyers escaping summer heat',
    marketTrends: 'Flagstaff faces inventory constraints due to national forest land. The market remains competitive, particularly for homes with mountain views and properties suitable for vacation rentals.'
  }
];

// Get city market data by slug
export function getCityMarketData(slug: string): CityMarketData | undefined {
  return ARIZONA_CITY_MARKET_DATA.find(city => city.slug === slug);
}

// Generate default market data for cities without detailed info
export function getDefaultCityMarketData(cityName: string, slug: string, medianPrice?: number): CityMarketData {
  return {
    slug,
    name: cityName,
    medianHomePrice: medianPrice,
    overview: `${cityName} offers a variety of housing options for buyers looking to settle in Arizona. The local real estate market features properties ranging from starter homes to luxury estates.`,
    highlights: [
      'Convenient access to Phoenix metropolitan amenities',
      'Growing community with new development opportunities',
      'Year-round sunshine and outdoor recreation',
      'Diverse housing options for various budgets'
    ],
    neighborhoodTypes: ['Single-family homes', 'Townhomes', 'New construction'],
    buyerProfile: 'Families, first-time buyers, and those relocating to Arizona',
    marketTrends: 'The local market continues to attract buyers seeking Arizona\'s lifestyle and value compared to coastal markets.'
  };
}
