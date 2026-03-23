/**
 * California Regional Packages — city bundles for the funnel Select Cities step.
 * Mirrors arizonaPackages.ts structure but for California regions.
 *
 * Every slug in includedCityIds is verified against the cities table
 * (state_slug=california, active=true) as of 2026-03-22.
 */

export type CaliforniaBundleCategory =
  | 'greater-la'
  | 'orange-county'
  | 'inland-empire'
  | 'san-diego'
  | 'sf-bay-area'
  | 'south-bay-silicon-valley'
  | 'sacramento'
  | 'central-valley'
  | 'central-coast'
  | 'desert'
  | 'north-state';

export interface CaliforniaRegionalPackage {
  id: string;
  name: string;
  description: string;
  category: CaliforniaBundleCategory;
  includedCityIds: string[]; // city slugs
}

export const CA_CATEGORY_LABELS: Record<CaliforniaBundleCategory, string> = {
  'greater-la': 'Greater Los Angeles',
  'orange-county': 'Orange County',
  'inland-empire': 'Inland Empire',
  'san-diego': 'San Diego',
  'sf-bay-area': 'SF Bay Area',
  'south-bay-silicon-valley': 'South Bay / Silicon Valley',
  'sacramento': 'Sacramento',
  'central-valley': 'Central Valley',
  'central-coast': 'Central Coast',
  'desert': 'Desert',
  'north-state': 'North State',
};

export const CA_CATEGORY_ORDER: CaliforniaBundleCategory[] = [
  'greater-la',
  'orange-county',
  'inland-empire',
  'san-diego',
  'sf-bay-area',
  'south-bay-silicon-valley',
  'sacramento',
  'central-valley',
  'central-coast',
  'desert',
  'north-state',
];

export const CALIFORNIA_PACKAGES: CaliforniaRegionalPackage[] = [
  // ═══════════════════════════════════════════════════════════
  // ── Greater Los Angeles ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-la-westside-beach',
    name: 'West LA / Beach Cities',
    description: 'Santa Monica, Malibu, Manhattan Beach, Hermosa Beach, Redondo Beach, El Segundo',
    category: 'greater-la',
    includedCityIds: [
      'santa-monica', 'malibu', 'manhattan-beach', 'hermosa-beach',
      'redondo-beach', 'marina-del-rey', 'venice', 'pacific-palisades',
      'playa-del-rey', 'el-segundo', 'playa-vista', 'mar-vista',
      'westchester',
    ],
  },
  {
    id: 'ca-la-hollywood-midcity',
    name: 'Hollywood / Mid-City',
    description: 'Hollywood, West Hollywood, Beverly Hills, Century City',
    category: 'greater-la',
    includedCityIds: [
      'hollywood', 'west-hollywood', 'beverly-hills', 'los-feliz',
      'century-city', 'brentwood', 'westwood',
    ],
  },
  {
    id: 'ca-la-san-fernando-valley',
    name: 'San Fernando Valley',
    description: 'Sherman Oaks, Encino, Woodland Hills, Calabasas, Burbank, Glendale',
    category: 'greater-la',
    includedCityIds: [
      'sherman-oaks', 'encino', 'woodland-hills', 'calabasas', 'tarzana',
      'northridge', 'burbank', 'glendale', 'north-hollywood', 'van-nuys',
      'reseda', 'canoga-park', 'chatsworth', 'granada-hills', 'panorama-city',
      'studio-city', 'sun-valley', 'toluca-lake', 'valley-village',
      'agoura-hills', 'hidden-hills', 'porter-ranch', 'sylmar', 'pacoima',
      'arleta',
    ],
  },
  {
    id: 'ca-la-pasadena-foothills',
    name: 'Pasadena / Foothills',
    description: 'Pasadena, Arcadia, Altadena, Monrovia, Glendora, Claremont',
    category: 'greater-la',
    includedCityIds: [
      'pasadena', 'arcadia', 'altadena', 'monrovia', 'glendora', 'claremont',
      'san-dimas', 'duarte', 'azusa', 'sierra-madre', 'south-pasadena',
      'san-marino', 'temple-city', 'la-verne', 'covina', 'west-covina',
      'diamond-bar', 'bradbury',
    ],
  },
  {
    id: 'ca-la-south-bay',
    name: 'South Bay',
    description: 'Torrance, Culver City, Hawthorne, Inglewood, Palos Verdes',
    category: 'greater-la',
    includedCityIds: [
      'torrance', 'culver-city', 'hawthorne', 'inglewood', 'gardena',
      'carson', 'lomita', 'palos-verdes-estates', 'rancho-palos-verdes',
      'rolling-hills', 'rolling-hills-estates', 'lawndale', 'del-aire',
      'alondra-park',
    ],
  },
  {
    id: 'ca-la-downtown-east',
    name: 'Downtown / East LA',
    description: 'Downtown LA, Alhambra, Monterey Park, El Monte, Montebello',
    category: 'greater-la',
    includedCityIds: [
      'los-angeles', 'east-los-angeles', 'alhambra', 'monterey-park',
      'el-monte', 'south-el-monte', 'rosemead', 'san-gabriel',
      'east-san-gabriel', 'montebello', 'commerce', 'bell', 'bell-gardens',
      'maywood', 'huntington-park', 'south-gate', 'lynwood', 'cudahy',
      'walnut', 'rowland-heights', 'hacienda-heights', 'la-puente',
      'west-puente-valley', 'baldwin-park', 'city-of-industry',
      'irwindale', 'eagle-rock', 'highland-park',
    ],
  },
  {
    id: 'ca-la-santa-clarita-north',
    name: 'Santa Clarita / North LA',
    description: 'Santa Clarita, Lancaster, Palmdale, Castaic',
    category: 'greater-la',
    includedCityIds: [
      'santa-clarita', 'lancaster', 'palmdale', 'acton', 'agua-dulce',
      'castaic', 'stevenson-ranch', 'quartz-hill', 'lake-los-angeles',
      'littlerock', 'lake-hughes', 'desert-view-highlands', 'elizabeth-lake',
    ],
  },
  {
    id: 'ca-la-long-beach-gateway',
    name: 'Long Beach / Gateway Cities',
    description: 'Long Beach, Downey, Whittier, Lakewood, Cerritos, Compton',
    category: 'greater-la',
    includedCityIds: [
      'long-beach', 'downey', 'whittier', 'lakewood', 'cerritos',
      'bellflower', 'norwalk', 'la-mirada', 'artesia', 'hawaiian-gardens',
      'paramount', 'south-whittier', 'east-whittier', 'pico-rivera',
      'santa-fe-springs', 'la-habra-heights', 'signal-hill', 'compton',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Orange County ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-oc-north',
    name: 'North Orange County',
    description: 'Anaheim, Fullerton, Buena Park, Brea, Yorba Linda, Huntington Beach',
    category: 'orange-county',
    includedCityIds: [
      'anaheim', 'fullerton', 'buena-park', 'brea', 'yorba-linda',
      'placentia', 'la-habra', 'cypress', 'stanton', 'garden-grove',
      'westminster', 'fountain-valley', 'los-alamitos', 'seal-beach',
      'huntington-beach', 'anaheim-hills',
    ],
  },
  {
    id: 'ca-oc-south-coastal',
    name: 'South OC / Coastal',
    description: 'Laguna Beach, Dana Point, San Clemente, San Juan Capistrano',
    category: 'orange-county',
    includedCityIds: [
      'laguna-beach', 'dana-point', 'san-clemente', 'san-juan-capistrano',
      'laguna-niguel', 'newport-beach', 'corona-del-mar', 'balboa-island',
    ],
  },
  {
    id: 'ca-oc-central',
    name: 'Central Orange County',
    description: 'Irvine, Costa Mesa, Tustin, Orange, Santa Ana',
    category: 'orange-county',
    includedCityIds: [
      'irvine', 'costa-mesa', 'tustin', 'orange', 'santa-ana',
      'villa-park', 'lake-forest',
    ],
  },
  {
    id: 'ca-oc-south-inland',
    name: 'South OC / Inland',
    description: 'Mission Viejo, Rancho Santa Margarita, Aliso Viejo, Ladera Ranch',
    category: 'orange-county',
    includedCityIds: [
      'mission-viejo', 'rancho-santa-margarita', 'aliso-viejo',
      'ladera-ranch', 'coto-de-caza', 'trabuco-canyon',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Inland Empire ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-ie-west',
    name: 'West Inland Empire',
    description: 'Ontario, Rancho Cucamonga, Upland, Fontana, Chino Hills, Pomona',
    category: 'inland-empire',
    includedCityIds: [
      'ontario', 'rancho-cucamonga', 'upland', 'claremont', 'fontana',
      'chino', 'chino-hills', 'montclair', 'pomona', 'alta-loma', 'etiwanda',
    ],
  },
  {
    id: 'ca-ie-east-riverside',
    name: 'East IE / Riverside',
    description: 'Riverside, Corona, Moreno Valley, Eastvale, Beaumont',
    category: 'inland-empire',
    includedCityIds: [
      'riverside', 'corona', 'moreno-valley', 'jurupa-valley',
      'eastvale', 'norco', 'perris', 'beaumont', 'banning', 'calimesa',
    ],
  },
  {
    id: 'ca-ie-temecula-valley',
    name: 'Temecula Valley',
    description: 'Temecula, Murrieta, Menifee, Lake Elsinore, Hemet',
    category: 'inland-empire',
    includedCityIds: [
      'temecula', 'murrieta', 'menifee', 'lake-elsinore', 'hemet',
      'san-jacinto', 'canyon-lake', 'wildomar', 'winchester',
    ],
  },
  {
    id: 'ca-ie-mountain-desert',
    name: 'Mountain / High Desert',
    description: 'Redlands, San Bernardino, Big Bear, Victorville, Hesperia',
    category: 'inland-empire',
    includedCityIds: [
      'redlands', 'san-bernardino', 'highland', 'big-bear-lake',
      'big-bear-city', 'loma-linda', 'colton', 'rialto', 'yucaipa',
      'running-springs', 'lake-arrowhead', 'crestline', 'hesperia',
      'victorville', 'apple-valley', 'adelanto', 'barstow',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── San Diego ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-sd-coastal',
    name: 'Coastal San Diego',
    description: 'La Jolla, Del Mar, Encinitas, Carlsbad, Oceanside, Coronado',
    category: 'san-diego',
    includedCityIds: [
      'la-jolla', 'del-mar', 'encinitas', 'carlsbad', 'oceanside',
      'coronado', 'solana-beach', 'imperial-beach',
    ],
  },
  {
    id: 'ca-sd-central',
    name: 'Central San Diego',
    description: 'San Diego proper',
    category: 'san-diego',
    includedCityIds: [
      'san-diego',
    ],
  },
  {
    id: 'ca-sd-north-inland',
    name: 'North County Inland',
    description: 'Escondido, San Marcos, Vista, Poway, Fallbrook',
    category: 'san-diego',
    includedCityIds: [
      'escondido', 'san-marcos', 'vista', 'poway', 'fallbrook',
      'valley-center', 'ramona',
    ],
  },
  {
    id: 'ca-sd-south-bay',
    name: 'South Bay San Diego',
    description: 'Chula Vista, National City, Bonita, Spring Valley',
    category: 'san-diego',
    includedCityIds: [
      'chula-vista', 'national-city', 'bonita',
      'spring-valley', 'lemon-grove',
    ],
  },
  {
    id: 'ca-sd-east-county',
    name: 'East County San Diego',
    description: 'El Cajon, La Mesa, Santee, Lakeside, Alpine',
    category: 'san-diego',
    includedCityIds: [
      'el-cajon', 'la-mesa', 'santee', 'lakeside', 'alpine',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── SF Bay Area ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-sf-city',
    name: 'San Francisco',
    description: 'San Francisco',
    category: 'sf-bay-area',
    includedCityIds: [
      'san-francisco',
    ],
  },
  {
    id: 'ca-sf-east-bay',
    name: 'East Bay',
    description: 'Oakland, Berkeley, Walnut Creek, Pleasanton, Concord, Fremont',
    category: 'sf-bay-area',
    includedCityIds: [
      'oakland', 'berkeley', 'walnut-creek', 'pleasanton', 'san-ramon',
      'danville', 'lafayette', 'orinda', 'moraga', 'concord', 'martinez',
      'pittsburg', 'antioch', 'brentwood', 'dublin', 'livermore',
      'fremont', 'hayward', 'union-city', 'newark', 'san-leandro',
      'alameda', 'castro-valley', 'el-cerrito', 'richmond', 'hercules',
      'pinole', 'el-sobrante', 'albany', 'emeryville', 'piedmont',
    ],
  },
  {
    id: 'ca-sf-peninsula',
    name: 'Peninsula',
    description: 'San Mateo, Redwood City, Burlingame, Daly City, Half Moon Bay',
    category: 'sf-bay-area',
    includedCityIds: [
      'san-mateo', 'redwood-city', 'san-carlos', 'burlingame', 'san-bruno',
      'daly-city', 'foster-city', 'belmont', 'half-moon-bay',
      'millbrae', 'south-san-francisco', 'pacifica', 'menlo-park',
      'atherton', 'woodside', 'portola-valley', 'hillsborough',
      'moss-beach', 'montara', 'el-granada', 'colma', 'broadmoor', 'brisbane',
    ],
  },
  {
    id: 'ca-sf-marin',
    name: 'Marin County',
    description: 'San Rafael, Mill Valley, Novato, Tiburon, Sausalito',
    category: 'sf-bay-area',
    includedCityIds: [
      'san-rafael', 'mill-valley', 'novato', 'tiburon', 'sausalito',
      'san-anselmo', 'larkspur', 'corte-madera', 'ross',
      'belvedere', 'kentfield', 'strawberry',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── South Bay / Silicon Valley ─────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-sv-silicon-valley',
    name: 'Silicon Valley',
    description: 'San Jose, Sunnyvale, Mountain View, Cupertino, Santa Clara, Palo Alto',
    category: 'south-bay-silicon-valley',
    includedCityIds: [
      'san-jose', 'sunnyvale', 'mountain-view', 'cupertino', 'santa-clara',
      'palo-alto', 'milpitas', 'east-foothills', 'alum-rock',
    ],
  },
  {
    id: 'ca-sv-south-peninsula',
    name: 'South Peninsula',
    description: 'Menlo Park, Los Altos, Los Gatos, Saratoga, Campbell',
    category: 'south-bay-silicon-valley',
    includedCityIds: [
      'campbell', 'los-gatos', 'saratoga', 'los-altos', 'los-altos-hills',
      'monte-sereno', 'east-palo-alto', 'cambrian-park',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Sacramento ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-sac-metro',
    name: 'Sacramento Metro',
    description: 'Sacramento, Elk Grove, Folsom, Roseville, Rocklin, Davis',
    category: 'sacramento',
    includedCityIds: [
      'sacramento', 'elk-grove', 'folsom', 'rancho-cordova', 'roseville',
      'rocklin', 'citrus-heights', 'carmichael', 'fair-oaks', 'orangevale',
      'arden-arcade', 'antelope', 'north-highlands', 'rio-linda',
      'gold-river', 'davis', 'woodland', 'west-sacramento',
      'granite-bay', 'lincoln', 'loomis', 'auburn',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Central Valley ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-cv-north',
    name: 'North Valley',
    description: 'Stockton, Modesto, Turlock, Tracy, Manteca, Lodi, Merced',
    category: 'central-valley',
    includedCityIds: [
      'stockton', 'modesto', 'turlock', 'tracy', 'manteca', 'lodi',
      'merced', 'ceres', 'oakdale', 'escalon', 'ripon', 'riverbank',
      'atwater', 'los-banos', 'livingston', 'patterson', 'newman',
    ],
  },
  {
    id: 'ca-cv-south',
    name: 'South Valley',
    description: 'Fresno, Visalia, Bakersfield, Clovis, Tulare, Delano',
    category: 'central-valley',
    includedCityIds: [
      'fresno', 'visalia', 'bakersfield', 'tulare', 'porterville',
      'hanford', 'clovis', 'madera', 'selma', 'sanger', 'reedley',
      'dinuba', 'kingsburg', 'lemoore', 'wasco', 'delano', 'shafter',
      'arvin', 'tehachapi', 'ridgecrest',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Central Coast ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-cc-ventura',
    name: 'Ventura County',
    description: 'Ventura, Thousand Oaks, Simi Valley, Camarillo, Oxnard',
    category: 'central-coast',
    includedCityIds: [
      'ventura', 'thousand-oaks', 'simi-valley', 'camarillo', 'moorpark',
      'oxnard', 'port-hueneme', 'ojai', 'fillmore', 'santa-paula',
      'oak-park', 'westlake-village', 'lake-sherwood',
    ],
  },
  {
    id: 'ca-cc-santa-barbara',
    name: 'Santa Barbara',
    description: 'Santa Barbara, Goleta, Carpinteria, Montecito, Solvang',
    category: 'central-coast',
    includedCityIds: [
      'santa-barbara', 'goleta', 'carpinteria', 'montecito', 'summerland',
      'isla-vista', 'buellton', 'solvang', 'lompoc', 'santa-maria',
      'guadalupe',
    ],
  },
  {
    id: 'ca-cc-slo-monterey',
    name: 'SLO / Monterey / Santa Cruz',
    description: 'San Luis Obispo, Paso Robles, Monterey, Carmel, Santa Cruz',
    category: 'central-coast',
    includedCityIds: [
      'san-luis-obispo', 'paso-robles', 'monterey', 'carmel-by-the-sea',
      'santa-cruz', 'atascadero', 'arroyo-grande', 'pismo-beach',
      'grover-beach', 'morro-bay', 'los-osos', 'cambria', 'cayucos',
      'pacific-grove', 'seaside', 'marina', 'salinas', 'capitola',
      'scotts-valley', 'watsonville', 'aptos', 'soquel',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── Desert ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-desert-coachella-valley',
    name: 'Coachella Valley',
    description: 'Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio',
    category: 'desert',
    includedCityIds: [
      'palm-springs', 'palm-desert', 'rancho-mirage', 'indian-wells',
      'la-quinta', 'indio', 'cathedral-city', 'desert-hot-springs',
      'coachella', 'bermuda-dunes', 'thousand-palms',
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ── North State ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ca-ns-north-state',
    name: 'North State',
    description: 'Redding, Chico, Red Bluff, Paradise, Oroville',
    category: 'north-state',
    includedCityIds: [
      'redding', 'chico', 'red-bluff', 'anderson', 'shasta-lake',
      'paradise', 'oroville', 'corning', 'tehama',
    ],
  },
  {
    id: 'ca-ns-wine-country',
    name: 'Wine Country',
    description: 'Napa, Sonoma, Petaluma, Santa Rosa, Healdsburg',
    category: 'north-state',
    includedCityIds: [
      'napa', 'sonoma', 'petaluma', 'santa-rosa', 'healdsburg',
      'windsor', 'rohnert-park', 'cotati', 'sebastopol', 'cloverdale',
      'calistoga', 'st-helena', 'yountville', 'american-canyon',
    ],
  },
];
