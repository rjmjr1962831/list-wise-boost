import { Professional } from './professional';

export interface City {
  name: string;
  state: string;
  slug: string;
  stateSlug: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  pluralName: string;
  icon: string;
  description: string;
  schemaType: string;
  accentColor: string;
  searchTerms: string[];
}

export interface CategoryData {
  category: CategoryConfig;
  professionals: Professional[];
  city: City;
}

export interface CityDirectoryData {
  city: City;
  categories: {
    [key: string]: Professional[];
  };
}
