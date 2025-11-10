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
    'top10dentists': phoenix.phoenixDentists,
    'top10realestateagents': phoenix.phoenixRealEstateAgents,
    'top10lawyers': phoenix.phoenixLawyers,
    'top10personalinjurylawyers': phoenix.phoenixPersonalInjuryLawyers,
    'top10businesslawyers': phoenix.phoenixBusinessLawyers,
    'top10realestatellawyers': phoenix.phoenixRealEstateLawyers,
    'top10restaurants': phoenix.phoenixRestaurants,
    'top10chineserestaurants': phoenix.phoenixChineseRestaurants,
    'top10pizzarestaurants': phoenix.phoenixPizzaRestaurants,
    'top10italianrestaurants': phoenix.phoenixItalianRestaurants,
    'top10sportsbars': phoenix.phoenixSportsBars,
    'top10fancyrestaurants': phoenix.phoenixFancyRestaurants,
    'top10cheapbutgood': phoenix.phoenixCheapButGood,
    'top10neurologists': phoenix.phoenixNeurologists
  },
  'los-angeles': {
    'top10dentists': losAngeles.losAngelesDentists,
    'top10realestateagents': losAngeles.losAngelesRealEstateAgents,
    'top10lawyers': losAngeles.losAngelesLawyers,
    'top10personalinjurylawyers': losAngeles.losAngelesPersonalInjuryLawyers,
    'top10businesslawyers': losAngeles.losAngelesBusinessLawyers,
    'top10realestatellawyers': losAngeles.losAngelesRealEstateLawyers,
    'top10restaurants': losAngeles.losAngelesRestaurants,
    'top10chineserestaurants': losAngeles.losAngelesChineseRestaurants,
    'top10pizzarestaurants': losAngeles.losAngelesPizzaRestaurants,
    'top10italianrestaurants': losAngeles.losAngelesItalianRestaurants,
    'top10sportsbars': losAngeles.losAngelesSportsBars,
    'top10fancyrestaurants': losAngeles.losAngelesFancyRestaurants,
    'top10cheapbutgood': losAngeles.losAngelesCheapButGood,
    'top10neurologists': []
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
