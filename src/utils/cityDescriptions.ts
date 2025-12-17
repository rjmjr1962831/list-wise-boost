// src/utils/cityDescriptions.ts
// Unique city descriptions to avoid duplicate content flags
// Each description is hand-crafted to be distinctive

interface CityDescriptionData {
  description: string;
  marketHighlight: string;
}

const cityDescriptions: Record<string, CityDescriptionData> = {
  'phoenix': {
    description: "Arizona's capital presents a dynamic real estate landscape spanning urban condos to desert estates. Top10Lists.us has identified the highest-performing agents navigating this diverse market.",
    marketHighlight: "Valley-wide expertise covering 500+ square miles of metropolitan opportunity"
  },
  'scottsdale': {
    description: "Luxury desert living defines Scottsdale's real estate scene, from Old Town charm to North Scottsdale's exclusive gated communities. Our curated selection features agents with proven high-end transaction records.",
    marketHighlight: "Specialists in resort properties, golf course estates, and luxury new construction"
  },
  'mesa': {
    description: "East Valley's largest city offers everything from historic downtown properties to master-planned communities. Top10Lists.us ranks agents who understand Mesa's neighborhood-by-neighborhood dynamics.",
    marketHighlight: "Deep knowledge spanning Superstition Springs to Red Mountain"
  },
  'chandler': {
    description: "Tech corridor growth has transformed Chandler into a sought-after destination. The agents featured here excel in serving relocating professionals and growing families.",
    marketHighlight: "Intel corridor expertise and top-rated school district navigation"
  },
  'gilbert': {
    description: "Once agricultural, Gilbert now ranks among America's fastest-growing towns. Our ranked agents specialize in its family-focused communities and new construction opportunities.",
    marketHighlight: "Master-planned community specialists with heritage district knowledge"
  },
  'tempe': {
    description: "University influence meets urban revitalization in Tempe's evolving market. Featured agents navigate everything from student housing investments to lakefront luxury.",
    marketHighlight: "Mill Avenue district and Tempe Town Lake corridor expertise"
  },
  'glendale': {
    description: "Sports and entertainment anchor Glendale's West Valley appeal. Top10Lists.us identifies agents versed in both historic neighborhoods and modern developments.",
    marketHighlight: "Westgate district and historic Catlin Court specialists"
  },
  'peoria': {
    description: "Spring training fame aside, Peoria offers diverse housing from starter homes to Lake Pleasant estates. Our curated list features agents with comprehensive West Valley reach.",
    marketHighlight: "Vistancia and Lake Pleasant waterfront property expertise"
  },
  'surprise': {
    description: "Rapid Northwest Valley expansion has made Surprise a relocation hotspot. Featured agents specialize in new construction and retirement community transitions.",
    marketHighlight: "Sun City Grand and Marley Park community specialists"
  },
  'goodyear': {
    description: "PGA West and Estrella Mountain define Goodyear's upscale trajectory. Our ranked agents excel in this emerging luxury market.",
    marketHighlight: "Golf course properties and Estrella Mountain Ranch experts"
  },
  'avondale': {
    description: "Accessibility to downtown Phoenix makes Avondale attractive for value-conscious buyers. Top10Lists.us features agents who maximize opportunity in this growing market.",
    marketHighlight: "First-time buyer specialists with West Valley commuter insight"
  },
  'buckeye': {
    description: "Arizona's fastest-growing city demands agents who understand its rapid transformation. Our selection features those navigating massive new development.",
    marketHighlight: "Verrado and Tartesso master-plan expertise"
  },
  'queen-creek': {
    description: "Equestrian properties meet suburban growth in Queen Creek's unique market. Featured agents specialize in acreage estates and family communities alike.",
    marketHighlight: "Horse property and large-lot specialists"
  },
  'san-tan-valley': {
    description: "Pinal County's population surge centers on San Tan Valley's affordable family housing. Our ranked agents understand this transitional market.",
    marketHighlight: "New construction and growing family specialists"
  },
  'fountain-hills': {
    description: "The famous fountain anchors this distinctive community of golf courses and mountain views. Top10Lists.us features agents specializing in Fountain Hills' premium lifestyle properties.",
    marketHighlight: "Golf community and custom home experts"
  },
  'cave-creek': {
    description: "Western heritage meets desert luxury in Cave Creek's distinctive market. Featured agents excel in custom homes and ranch properties.",
    marketHighlight: "Custom desert estate and equestrian property specialists"
  },
  'carefree': {
    description: "Arizona's most exclusive small town demands agents with ultra-luxury expertise. Our selection features those serving Carefree's discerning clientele.",
    marketHighlight: "Multi-million dollar custom home specialists"
  },
  'paradise-valley': {
    description: "Arizona's wealthiest municipality requires agents versed in estates, privacy, and discretion. Top10Lists.us ranks those proven in Paradise Valley's elite market.",
    marketHighlight: "Ultra-luxury estate and celebrity property experts"
  },
  'litchfield-park': {
    description: "Historic charm meets Wigwam Resort prestige in Litchfield Park. Featured agents understand this tight-knit community's unique appeal.",
    marketHighlight: "Historic district and resort-adjacent property specialists"
  },
  'el-mirage': {
    description: "Affordability drives El Mirage's appeal for first-time buyers and investors. Our ranked agents maximize value in this accessible market.",
    marketHighlight: "Investment property and first-time buyer experts"
  },
  'sun-city': {
    description: "America's original active adult community requires specialized knowledge. Top10Lists.us features agents expert in Sun City's unique age-restricted market.",
    marketHighlight: "55+ community and recreation-focused lifestyle specialists"
  },
  'sun-city-west': {
    description: "Expanded amenities distinguish Sun City West's active adult lifestyle. Featured agents specialize in this vibrant retirement destination.",
    marketHighlight: "Active adult community and lifestyle transition experts"
  },
  'anthem': {
    description: "Master-planned perfection defines Anthem's family-focused communities. Our ranked agents excel in this North Phoenix corridor.",
    marketHighlight: "Country Club and Parkside community specialists"
  },
  'new-river': {
    description: "Rural character near urban amenities attracts buyers to New River. Top10Lists.us features agents versed in larger lots and desert living.",
    marketHighlight: "Acreage property and rural lifestyle specialists"
  },
  'rio-verde': {
    description: "Golf and desert beauty define Rio Verde's resort lifestyle. Featured agents specialize in this distinctive Fountain Hills-adjacent community.",
    marketHighlight: "Golf course and desert foothills property experts"
  },
  'gold-canyon': {
    description: "Superstition Mountain views anchor Gold Canyon's scenic appeal. Our ranked agents understand this gateway to Arizona's iconic wilderness.",
    marketHighlight: "Mountain view and outdoor lifestyle specialists"
  },
  'apache-junction': {
    description: "Superstition Mountains backdrop attracts both retirees and adventurers. Top10Lists.us features agents navigating AJ's diverse housing options.",
    marketHighlight: "Manufactured home and mountain-access property experts"
  },
  'florence': {
    description: "Historic Arizona meets growing bedroom community in Florence. Featured agents understand this Pinal County seat's evolution.",
    marketHighlight: "Historic property and rural development specialists"
  },
  'coolidge': {
    description: "Agricultural roots support Coolidge's affordable family housing. Our ranked agents serve buyers seeking value outside the Valley core.",
    marketHighlight: "Affordable family home and rural property experts"
  },
  'casa-grande': {
    description: "Interstate accessibility positions Casa Grande for continued growth. Top10Lists.us features agents capitalizing on this corridor's potential.",
    marketHighlight: "I-10 corridor and new development specialists"
  },
  'maricopa': {
    description: "Explosive growth has transformed Maricopa into a commuter destination. Featured agents specialize in its master-planned communities.",
    marketHighlight: "Province and Rancho El Dorado community experts"
  },
  'eloy': {
    description: "Skydiving capital aside, Eloy offers agricultural land and affordable housing. Our ranked agents serve this Pinal County market.",
    marketHighlight: "Agricultural land and affordable housing specialists"
  },
  'tucson': {
    description: "University culture meets desert beauty in Arizona's second city. Top10Lists.us identifies agents navigating Tucson's distinct neighborhoods.",
    marketHighlight: "Foothills to downtown expertise spanning diverse price points"
  },
  'oro-valley': {
    description: "Catalina Mountain foothills frame Oro Valley's upscale communities. Featured agents excel in this Tucson-area premium market.",
    marketHighlight: "Golf course and mountain-view property specialists"
  },
  'marana': {
    description: "Northwest Tucson growth has elevated Marana's profile. Our ranked agents understand its transition from rural to suburban destination.",
    marketHighlight: "Dove Mountain and Continental Ranch community experts"
  },
  'sahuarita': {
    description: "Planned communities attract families to Sahuarita's affordable quality of life. Top10Lists.us features agents serving this growing market.",
    marketHighlight: "Rancho Sahuarita and new construction specialists"
  },
  'green-valley': {
    description: "Retirement destination Green Valley offers value south of Tucson. Featured agents specialize in active adult and 55+ communities.",
    marketHighlight: "Retirement community and snowbird property experts"
  },
  'catalina-foothills': {
    description: "Tucson's most prestigious address demands specialized expertise. Our ranked agents serve the Foothills' luxury market.",
    marketHighlight: "Luxury estate and mountain-view custom home specialists"
  },
  'tanque-verde': {
    description: "Horse properties and custom estates define Tanque Verde's character. Top10Lists.us features agents versed in this East Tucson enclave.",
    marketHighlight: "Equestrian property and custom home experts"
  },
  'casas-adobes': {
    description: "Established neighborhoods and mature landscaping distinguish Casas Adobes. Featured agents understand this Northwest Tucson community.",
    marketHighlight: "Established neighborhood and family home specialists"
  },
  'flowing-wells': {
    description: "Affordable housing near Tucson's core attracts value-seeking buyers. Our ranked agents maximize opportunity in Flowing Wells.",
    marketHighlight: "First-time buyer and investment property experts"
  },
  'drexel-heights': {
    description: "Southwest Tucson accessibility drives Drexel Heights appeal. Top10Lists.us features agents serving this growing community.",
    marketHighlight: "Affordable family home and starter property specialists"
  },
  'valencia-west': {
    description: "New development characterizes Valencia West's emergence. Featured agents specialize in this Tucson-area growth corridor.",
    marketHighlight: "New construction and growing community experts"
  },
  'vail': {
    description: "Highly-rated schools anchor Vail's family appeal. Our ranked agents understand this Southeast Tucson destination.",
    marketHighlight: "Top school district and family community specialists"
  },
  'corona-de-tucson': {
    description: "Rural character near city amenities defines Corona de Tucson. Top10Lists.us features agents versed in larger properties.",
    marketHighlight: "Acreage and rural lifestyle property experts"
  },
  'rita-ranch': {
    description: "Master-planned living attracts families to Rita Ranch. Featured agents excel in this Southeast Tucson community.",
    marketHighlight: "Family community and new construction specialists"
  },
  'dove-mountain': {
    description: "Golf resort living defines Dove Mountain's luxury appeal. Our ranked agents serve this Marana-area premium destination.",
    marketHighlight: "Resort property and golf course home experts"
  },
  'saddlebrooke': {
    description: "Active adult excellence characterizes SaddleBrooke's lifestyle communities. Top10Lists.us features agents specializing in 55+ transitions.",
    marketHighlight: "Active adult and retirement community specialists"
  },
  'prescott': {
    description: "Mile-high climate and historic downtown attract diverse buyers to Prescott. Featured agents navigate this mountain market.",
    marketHighlight: "Historic property and mountain lifestyle specialists"
  },
  'prescott-valley': {
    description: "Affordability near Prescott drives Prescott Valley growth. Our ranked agents understand this accessible mountain community.",
    marketHighlight: "Value-focused mountain living and family home experts"
  },
  'sedona': {
    description: "Red rock splendor creates Sedona's unique real estate dynamic. Top10Lists.us features agents versed in this destination market.",
    marketHighlight: "Vacation property and red rock view home specialists"
  },
  'flagstaff': {
    description: "Four-season mountain living defines Flagstaff's appeal. Featured agents navigate this university town's competitive market.",
    marketHighlight: "Mountain property and NAU-area specialists"
  },
  'payson': {
    description: "Rim Country escape attracts Phoenix residents to Payson. Our ranked agents understand this forest retreat market.",
    marketHighlight: "Mountain cabin and second home specialists"
  },
  'show-low': {
    description: "White Mountain gateway Show Low offers affordable mountain living. Top10Lists.us features agents serving this Four Corners region.",
    marketHighlight: "Mountain retreat and affordable cabin specialists"
  },
  'pinetop-lakeside': {
    description: "Arizona's mountain playground attracts vacation buyers to Pinetop-Lakeside. Featured agents specialize in this resort market.",
    marketHighlight: "Vacation home and forest property experts"
  },
  'lake-havasu-city': {
    description: "London Bridge anchors Lake Havasu's waterfront lifestyle. Our ranked agents excel in this recreation destination.",
    marketHighlight: "Waterfront property and boat-access home specialists"
  },
  'bullhead-city': {
    description: "Colorado River recreation defines Bullhead City's appeal. Top10Lists.us features agents versed in this Mohave County market.",
    marketHighlight: "River property and affordable desert living experts"
  },
  'kingman': {
    description: "Route 66 heritage meets Arizona affordability in Kingman. Featured agents navigate this growing Northwest Arizona market.",
    marketHighlight: "Affordable housing and historic property specialists"
  },
  'yuma': {
    description: "Winter warmth attracts snowbirds to Yuma's desert lifestyle. Our ranked agents understand this agricultural corridor.",
    marketHighlight: "Snowbird property and agricultural land experts"
  },
  'sierra-vista': {
    description: "Fort Huachuca anchors Sierra Vista's stable market. Top10Lists.us features agents serving this Cochise County community.",
    marketHighlight: "Military relocation and mountain-view property specialists"
  },
  'cottonwood': {
    description: "Verde Valley wine country attracts lifestyle buyers to Cottonwood. Featured agents specialize in this emerging destination.",
    marketHighlight: "Wine country and Verde Valley lifestyle property experts"
  },
  'nogales': {
    description: "Border community Nogales offers unique investment opportunities. Our ranked agents understand this binational market.",
    marketHighlight: "Border commerce and investment property specialists"
  }
};

/**
 * Get a unique description for a city to avoid duplicate content
 */
export function getCityDescription(slug: string, cityName: string, stateName: string): string {
  const cityData = cityDescriptions[slug];
  
  if (cityData) {
    return cityData.description;
  }
  
  // Fallback for cities not yet added - still unique based on city name
  return `Top10Lists.us presents verified rankings of elite real estate professionals serving ${cityName}, ${stateName}. Our editorial selection process evaluates reviews, community involvement, transaction history, and credentials to identify the market's top performers.`;
}

/**
 * Get the market highlight for a city
 */
export function getCityMarketHighlight(slug: string): string | null {
  return cityDescriptions[slug]?.marketHighlight || null;
}

/**
 * Get all available city slugs with custom descriptions
 */
export function getAvailableCityDescriptions(): string[] {
  return Object.keys(cityDescriptions);
}
