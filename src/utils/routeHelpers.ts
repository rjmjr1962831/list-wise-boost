import { City } from '@/types/directory';

export function generateCityUrl(city: City): string {
  return `/${city.stateSlug}/${city.slug}`;
}

export function generateCategoryUrl(city: City, categorySlug: string): string {
  return `/${city.stateSlug}/${city.slug}/${categorySlug}`;
}

export function formatCityName(city: City): string {
  return `${city.name}, ${city.state}`;
}

export function generatePageTitle(city: City, categoryName: string): string {
  return `Top ${categoryName} in:\n${city.name}, ${city.state}`;
}

export function generateMetaDescription(city: City, categoryName: string): string {
  return `After thorough research and analysis, we think these are some of the best ${categoryName.toLowerCase()} in ${city.name}, ${city.state}. Expert-vetted professionals with verified licenses, reputations, community involvement, reviews, ratings and transaction history.`;
}

export function generateAgentSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateAgentProfileUrl(
  stateSlug: string,
  citySlug: string, 
  categorySlug: string,
  agentName: string
): string {
  const agentSlug = generateAgentSlug(agentName);
  return `/${stateSlug}/${citySlug}/${categorySlug}/${agentSlug}`;
}
