import { Professional } from '@/types/professional';
import { City } from '@/types/directory';
import * as phoenix from './sampleData/phoenix';
import * as losAngeles from './sampleData/los-angeles';

type CategoryDataMap = {
  [categorySlug: string]: Professional[];
};

type CityDataMap = {
  [citySlug: string]: CategoryDataMap;
};

const cityData: CityDataMap = {
  'phoenix': {
    'dentists': phoenix.phoenixDentists,
    'realtors': phoenix.phoenixRealtors,
    'lawyers': phoenix.phoenixLawyers,
    'personal-injury-lawyers': phoenix.phoenixPersonalInjuryLawyers,
    'business-lawyers': phoenix.phoenixBusinessLawyers,
    'real-estate-lawyers': phoenix.phoenixRealEstateLawyers,
    'restaurants': phoenix.phoenixRestaurants,
    'chinese-restaurants': phoenix.phoenixChineseRestaurants,
    'pizza-restaurants': phoenix.phoenixPizzaRestaurants,
    'italian-restaurants': phoenix.phoenixItalianRestaurants,
    'sports-bars': phoenix.phoenixSportsBars,
    'fancy-restaurants': phoenix.phoenixFancyRestaurants,
    'cheap-but-good': phoenix.phoenixCheapButGood
  },
  'los-angeles': {
    'dentists': losAngeles.losAngelesDentists,
    'realtors': losAngeles.losAngelesRealtors,
    'lawyers': losAngeles.losAngelesLawyers,
    'personal-injury-lawyers': losAngeles.losAngelesPersonalInjuryLawyers,
    'business-lawyers': losAngeles.losAngelesBusinessLawyers,
    'real-estate-lawyers': losAngeles.losAngelesRealEstateLawyers,
    'restaurants': losAngeles.losAngelesRestaurants,
    'chinese-restaurants': losAngeles.losAngelesChineseRestaurants,
    'pizza-restaurants': losAngeles.losAngelesPizzaRestaurants,
    'italian-restaurants': losAngeles.losAngelesItalianRestaurants,
    'sports-bars': losAngeles.losAngelesSportsBars,
    'fancy-restaurants': losAngeles.losAngelesFancyRestaurants,
    'cheap-but-good': losAngeles.losAngelesCheapButGood
  }
};

export function getProfessionalsByCategory(city: City, categorySlug: string): Professional[] {
  return cityData[city.slug]?.[categorySlug] || [];
}

export function hasDataForCity(citySlug: string): boolean {
  return citySlug in cityData;
}

export function getAvailableCategories(citySlug: string): string[] {
  return Object.keys(cityData[citySlug] || {});
}
