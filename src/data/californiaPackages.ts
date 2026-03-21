/**
 * California Regional Packages — city bundles for the funnel Select Cities step.
 * Mirrors arizonaPackages.ts structure but for California regions.
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
  // ── Greater Los Angeles ──
  {
    id: 'ca-greater-la',
    name: 'Greater Los Angeles',
    description: 'LA, Beverly Hills, Glendale, Pasadena, Long Beach, Sherman Oaks',
    category: 'greater-la',
    includedCityIds: [
      'los-angeles', 'beverly-hills', 'glendale', 'pasadena',
      'long-beach', 'sherman-oaks',
    ],
  },

  // ── Orange County ──
  {
    id: 'ca-orange-county',
    name: 'Orange County',
    description: 'Irvine, Newport Beach, Santa Ana, Anaheim',
    category: 'orange-county',
    includedCityIds: [
      'irvine', 'newport-beach', 'santa-ana', 'anaheim',
    ],
  },

  // ── Inland Empire ──
  {
    id: 'ca-inland-empire',
    name: 'Inland Empire',
    description: 'Riverside, Rancho Cucamonga, Corona, San Bernardino',
    category: 'inland-empire',
    includedCityIds: [
      'riverside', 'rancho-cucamonga', 'corona', 'san-bernardino',
    ],
  },

  // ── San Diego ──
  {
    id: 'ca-san-diego',
    name: 'San Diego',
    description: 'San Diego, Carlsbad, Temecula, Escondido',
    category: 'san-diego',
    includedCityIds: [
      'san-diego', 'carlsbad', 'temecula', 'escondido',
    ],
  },

  // ── SF Bay Area ──
  {
    id: 'ca-sf-bay-area',
    name: 'SF Bay Area',
    description: 'San Francisco, Oakland, Fremont, San Mateo, Concord',
    category: 'sf-bay-area',
    includedCityIds: [
      'san-francisco', 'oakland', 'fremont', 'san-mateo', 'concord',
    ],
  },

  // ── South Bay / Silicon Valley ──
  {
    id: 'ca-south-bay-sv',
    name: 'South Bay / Silicon Valley',
    description: 'San Jose, Sunnyvale, Palo Alto, Livermore',
    category: 'south-bay-silicon-valley',
    includedCityIds: [
      'san-jose', 'sunnyvale', 'palo-alto', 'livermore',
    ],
  },

  // ── Sacramento ──
  {
    id: 'ca-sacramento',
    name: 'Sacramento',
    description: 'Sacramento, Roseville, Davis',
    category: 'sacramento',
    includedCityIds: [
      'sacramento', 'roseville', 'davis',
    ],
  },

  // ── Central Valley ──
  {
    id: 'ca-central-valley',
    name: 'Central Valley',
    description: 'Fresno, Bakersfield, Stockton, Visalia',
    category: 'central-valley',
    includedCityIds: [
      'fresno', 'bakersfield', 'stockton', 'visalia',
    ],
  },

  // ── Central Coast ──
  {
    id: 'ca-central-coast',
    name: 'Central Coast',
    description: 'Oxnard, Santa Barbara, San Luis Obispo',
    category: 'central-coast',
    includedCityIds: [
      'oxnard', 'santa-barbara', 'san-luis-obispo',
    ],
  },

  // ── Desert ──
  {
    id: 'ca-desert',
    name: 'Desert',
    description: 'Palm Springs, Palm Desert',
    category: 'desert',
    includedCityIds: [
      'palm-springs', 'palm-desert',
    ],
  },

  // ── North State ──
  {
    id: 'ca-north-state',
    name: 'North State',
    description: 'Redding, Chico, Napa, San Rafael',
    category: 'north-state',
    includedCityIds: [
      'redding', 'chico', 'napa', 'san-rafael',
    ],
  },
];
