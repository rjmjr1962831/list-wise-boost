export interface ProfessionalStats {
  salesLast12Mo?: number;
  saleToListRatio?: string;
  avgDaysOnMarket?: number;
  yearsExperience?: number;
  patientsServed?: number;
  successRate?: string;
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
