import { CategoryConfig } from '@/types/directory';

export const categories: Record<string, CategoryConfig> = {
  'top10realestateagents': {
    id: 'top10realestateagents',
    name: 'Real Estate Agent',
    pluralName: 'Real Estate Agents',
    icon: 'Home',
    description: 'Premier real estate agents',
    schemaType: 'RealEstateAgent',
    accentColor: 'green',
    searchTerms: ['real estate agent', 'real estate', 'homes', 'property']
  }
};

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return categories[slug];
}

export function getAllCategories(): CategoryConfig[] {
  return Object.values(categories);
}
