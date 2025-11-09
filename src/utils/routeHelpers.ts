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
  return `Top ${categoryName} in ${city.name}, ${city.state} | Top10Lists`;
}

export function generateMetaDescription(city: City, categoryName: string): string {
  return `Discover the best ${categoryName.toLowerCase()} in ${city.name}, ${city.state}. Expert-vetted professionals with verified reviews and ratings.`;
}
