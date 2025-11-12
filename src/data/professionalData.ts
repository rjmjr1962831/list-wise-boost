import { Professional } from '@/types/professional';
import { City } from '@/types/directory';
import * as phoenix from './sampleData/phoenix';
import * as losAngeles from './sampleData/los-angeles';
import * as anaheim from './sampleData/anaheim';

type CategoryDataMap = {
  [categorySlug: string]: Professional[];
};

type CityDataMap = {
  [citySlug: string]: CategoryDataMap;
};

const cityData: CityDataMap = {
  'phoenix': {
    'top10realestateagents': phoenix.phoenixRealEstateAgents
  },
  'los-angeles': {
    'top10realestateagents': losAngeles.losAngelesRealEstateAgents
  },
  'anaheim': {
    'top10realestateagents': anaheim.anaheimRealEstateAgents
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
