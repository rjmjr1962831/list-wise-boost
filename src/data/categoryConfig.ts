import { CategoryConfig } from '@/types/directory';

export const categories: Record<string, CategoryConfig> = {
  dentists: {
    id: 'dentists',
    name: 'Dentist',
    pluralName: 'Dentists',
    icon: 'Activity',
    description: 'Top-rated dental professionals',
    schemaType: 'Dentist',
    accentColor: 'blue',
    searchTerms: ['dental', 'dentist', 'teeth', 'oral health']
  },
  realtors: {
    id: 'realtors',
    name: 'Realtor',
    pluralName: 'Realtors',
    icon: 'Home',
    description: 'Premier real estate agents',
    schemaType: 'RealEstateAgent',
    accentColor: 'green',
    searchTerms: ['realtor', 'real estate', 'homes', 'property']
  },
  lawyers: {
    id: 'lawyers',
    name: 'Lawyer',
    pluralName: 'Lawyers',
    icon: 'Scale',
    description: 'Experienced legal professionals',
    schemaType: 'Attorney',
    accentColor: 'purple',
    searchTerms: ['lawyer', 'attorney', 'legal']
  },
  'personal-injury-lawyers': {
    id: 'personal-injury-lawyers',
    name: 'Personal Injury Lawyer',
    pluralName: 'Personal Injury Lawyers',
    icon: 'ShieldAlert',
    description: 'Specialized personal injury attorneys',
    schemaType: 'Attorney',
    accentColor: 'red',
    searchTerms: ['personal injury', 'accident lawyer', 'injury attorney']
  },
  'business-lawyers': {
    id: 'business-lawyers',
    name: 'Business Lawyer',
    pluralName: 'Business Lawyers',
    icon: 'Briefcase',
    description: 'Corporate and business law experts',
    schemaType: 'Attorney',
    accentColor: 'indigo',
    searchTerms: ['business lawyer', 'corporate attorney', 'business law']
  },
  'real-estate-lawyers': {
    id: 'real-estate-lawyers',
    name: 'Real Estate Lawyer',
    pluralName: 'Real Estate Lawyers',
    icon: 'Building',
    description: 'Property and real estate legal specialists',
    schemaType: 'Attorney',
    accentColor: 'teal',
    searchTerms: ['real estate lawyer', 'property attorney', 'real estate law']
  },
  restaurants: {
    id: 'restaurants',
    name: 'Restaurant',
    pluralName: 'Restaurants',
    icon: 'Utensils',
    description: 'Top dining destinations',
    schemaType: 'Restaurant',
    accentColor: 'orange',
    searchTerms: ['restaurant', 'dining', 'food']
  },
  'chinese-restaurants': {
    id: 'chinese-restaurants',
    name: 'Chinese Restaurant',
    pluralName: 'Chinese Restaurants',
    icon: 'UtensilsCrossed',
    description: 'Authentic Chinese cuisine',
    schemaType: 'Restaurant',
    accentColor: 'rose',
    searchTerms: ['chinese food', 'chinese restaurant', 'asian cuisine']
  },
  'pizza-restaurants': {
    id: 'pizza-restaurants',
    name: 'Pizza Restaurant',
    pluralName: 'Pizza Restaurants',
    icon: 'Pizza',
    description: 'Best pizza spots',
    schemaType: 'Restaurant',
    accentColor: 'amber',
    searchTerms: ['pizza', 'pizzeria', 'italian pizza']
  },
  'italian-restaurants': {
    id: 'italian-restaurants',
    name: 'Italian Restaurant',
    pluralName: 'Italian Restaurants',
    icon: 'Wine',
    description: 'Finest Italian dining',
    schemaType: 'Restaurant',
    accentColor: 'emerald',
    searchTerms: ['italian food', 'italian restaurant', 'pasta']
  },
  'sports-bars': {
    id: 'sports-bars',
    name: 'Sports Bar',
    pluralName: 'Sports Bars',
    icon: 'Trophy',
    description: 'Popular sports bar destinations',
    schemaType: 'Restaurant',
    accentColor: 'cyan',
    searchTerms: ['sports bar', 'sports pub', 'game day']
  },
  'fancy-restaurants': {
    id: 'fancy-restaurants',
    name: 'Fine Dining Restaurant',
    pluralName: 'Fine Dining Restaurants',
    icon: 'Sparkles',
    description: 'Upscale dining experiences',
    schemaType: 'Restaurant',
    accentColor: 'violet',
    searchTerms: ['fine dining', 'upscale restaurant', 'fancy restaurant']
  },
  'cheap-but-good': {
    id: 'cheap-but-good',
    name: 'Budget-Friendly Restaurant',
    pluralName: 'Budget-Friendly Restaurants',
    icon: 'DollarSign',
    description: 'Great food at affordable prices',
    schemaType: 'Restaurant',
    accentColor: 'lime',
    searchTerms: ['cheap eats', 'affordable dining', 'budget restaurant']
  }
};

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return categories[slug];
}

export function getAllCategories(): CategoryConfig[] {
  return Object.values(categories);
}
