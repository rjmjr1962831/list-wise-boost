export interface ProfessionalStats {
  saleToListRatio?: string;
  avgDaysOnMarket?: number;
  yearsExperience?: number;
  patientsServed?: number;
  successRate?: string;
  currentListings?: number;
  totalSales?: number;
  [key: string]: string | number | undefined;
}

export interface Testimonial {
  author: string;
  text: string;
  source?: string;
  date?: string;
}

export interface Professional {
  rank: number;
  name: string;
  id?: string; // DB primary key for updates
  title?: string; // e.g., "DDS", "DMD"
  company: string; // brokerage, practice, firm, etc.
  rating: number;
  reviews: number;
  specialties: string[];
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  stats: ProfessionalStats;
  verified: boolean;
  image: string;
  testimonials?: Testimonial[];
  license_number?: string;
  license_verified_at?: string;
  zuid?: string | null; // Zillow unique agent ID
  current_listings?: number; // Real data from Zillow
  total_sales?: number; // Real data from Zillow
  zip_code?: string | null; // US zip code for API lookups
  years_experience?: number; // Years in business
  zillow_data_fetched_at?: string; // Timestamp of last Zillow data fetch
  get_to_know_me?: string; // Rewritten bio from Zillow's getToKnowMe
}

export interface ListSection {
  title: string;
  description: string;
  accentColor: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  items: Professional[];
}

export interface PageMetadata {
  title: string;
  description: string;
  breadcrumbs: Array<{ name: string; path?: string }>;
  location: {
    city: string;
    state: string;
    stateAbbr: string;
  };
  profession: {
    singular: string; // "Real Estate Agent", "Dentist"
    plural: string; // "Real Estate Agents", "Dentists"
    schemaType: string; // "RealEstateAgent", "Dentist"
  };
}
