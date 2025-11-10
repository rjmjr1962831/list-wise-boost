import { CategoryConfig } from '@/types/directory';

export const categories: Record<string, CategoryConfig> = {
  top10dentists: {
    id: 'top10dentists',
    name: 'Dentist',
    pluralName: 'Dentists',
    icon: 'Activity',
    description: 'Top-rated dental professionals',
    schemaType: 'Dentist',
    accentColor: 'blue',
    searchTerms: ['dental', 'dentist', 'teeth', 'oral health']
  },
  'top10realestateagents': {
    id: 'top10realestateagents',
    name: 'Real Estate Agent',
    pluralName: 'Real Estate Agents',
    icon: 'Home',
    description: 'Premier real estate agents',
    schemaType: 'RealEstateAgent',
    accentColor: 'green',
    searchTerms: ['real estate agent', 'real estate', 'homes', 'property']
  },
  top10lawyers: {
    id: 'top10lawyers',
    name: 'Lawyer',
    pluralName: 'Lawyers',
    icon: 'Scale',
    description: 'Experienced legal professionals',
    schemaType: 'Attorney',
    accentColor: 'purple',
    searchTerms: ['lawyer', 'attorney', 'legal']
  },
  'top10personalinjurylawyers': {
    id: 'top10personalinjurylawyers',
    name: 'Personal Injury Lawyer',
    pluralName: 'Personal Injury Lawyers',
    icon: 'ShieldAlert',
    description: 'Specialized personal injury attorneys',
    schemaType: 'Attorney',
    accentColor: 'red',
    searchTerms: ['personal injury', 'accident lawyer', 'injury attorney']
  },
  'top10businesslawyers': {
    id: 'top10businesslawyers',
    name: 'Business Lawyer',
    pluralName: 'Business Lawyers',
    icon: 'Briefcase',
    description: 'Corporate and business law experts',
    schemaType: 'Attorney',
    accentColor: 'indigo',
    searchTerms: ['business lawyer', 'corporate attorney', 'business law']
  },
  'top10realestatellawyers': {
    id: 'top10realestatellawyers',
    name: 'Real Estate Lawyer',
    pluralName: 'Real Estate Lawyers',
    icon: 'Building',
    description: 'Property and real estate legal specialists',
    schemaType: 'Attorney',
    accentColor: 'teal',
    searchTerms: ['real estate lawyer', 'property attorney', 'real estate law']
  },
  top10restaurants: {
    id: 'top10restaurants',
    name: 'Restaurant',
    pluralName: 'Restaurants',
    icon: 'Utensils',
    description: 'Top dining destinations',
    schemaType: 'Restaurant',
    accentColor: 'orange',
    searchTerms: ['restaurant', 'dining', 'food']
  },
  'top10chineserestaurants': {
    id: 'top10chineserestaurants',
    name: 'Chinese Restaurant',
    pluralName: 'Chinese Restaurants',
    icon: 'UtensilsCrossed',
    description: 'Authentic Chinese cuisine',
    schemaType: 'Restaurant',
    accentColor: 'rose',
    searchTerms: ['chinese food', 'chinese restaurant', 'asian cuisine']
  },
  'top10pizzarestaurants': {
    id: 'top10pizzarestaurants',
    name: 'Pizza Restaurant',
    pluralName: 'Pizza Restaurants',
    icon: 'Pizza',
    description: 'Best pizza spots',
    schemaType: 'Restaurant',
    accentColor: 'amber',
    searchTerms: ['pizza', 'pizzeria', 'italian pizza']
  },
  'top10italianrestaurants': {
    id: 'top10italianrestaurants',
    name: 'Italian Restaurant',
    pluralName: 'Italian Restaurants',
    icon: 'Wine',
    description: 'Finest Italian dining',
    schemaType: 'Restaurant',
    accentColor: 'emerald',
    searchTerms: ['italian food', 'italian restaurant', 'pasta']
  },
  'top10sportsbars': {
    id: 'top10sportsbars',
    name: 'Sports Bar',
    pluralName: 'Sports Bars',
    icon: 'Trophy',
    description: 'Popular sports bar destinations',
    schemaType: 'Restaurant',
    accentColor: 'cyan',
    searchTerms: ['sports bar', 'sports pub', 'game day']
  },
  'top10fancyrestaurants': {
    id: 'top10fancyrestaurants',
    name: 'Fine Dining Restaurant',
    pluralName: 'Fine Dining Restaurants',
    icon: 'Sparkles',
    description: 'Upscale dining experiences',
    schemaType: 'Restaurant',
    accentColor: 'violet',
    searchTerms: ['fine dining', 'upscale restaurant', 'fancy restaurant']
  },
  'top10cheapbutgood': {
    id: 'top10cheapbutgood',
    name: 'Budget-Friendly Restaurant',
    pluralName: 'Budget-Friendly Restaurants',
    icon: 'DollarSign',
    description: 'Great food at affordable prices',
    schemaType: 'Restaurant',
    accentColor: 'lime',
    searchTerms: ['cheap eats', 'affordable dining', 'budget restaurant']
  },
  'top10neurologists': {
    id: 'top10neurologists',
    name: 'Neurologist',
    pluralName: 'Neurologists',
    icon: 'Brain',
    description: 'Top neurologists specializing in brain and nervous system disorders',
    schemaType: 'Physician',
    accentColor: 'primary',
    searchTerms: ['neurologist', 'brain doctor', 'movement disorders', 'neurology', 'parkinson\'s', 'epilepsy']
  }
};

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return categories[slug];
}

export function getAllCategories(): CategoryConfig[] {
  return Object.values(categories);
}
