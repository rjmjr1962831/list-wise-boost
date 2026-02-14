/**
 * GEO Place Graph Schema - @graph pattern for Place, Dataset, Person linkage
 */

/** Default dateModified: 7-day window */
function getDefaultDateModified(): string {
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export interface CityPlaceGraphInput {
  cityName: string;
  stateName: string;
  stateSlug: string;
  citySlug: string;
  cityId?: string;
  overview: string;
  medianHomePrice?: number;
  population?: number;
  agentIds?: string[];
  agentNames?: string[];
  dateModified?: string;
}

export interface NeighborhoodPlaceGraphInput {
  neighborhoodName: string;
  cityName: string;
  stateName: string;
  stateSlug: string;
  neighborhoodSlug: string;
  citySlug: string;
  neighborhoodId?: string;
  zipCode?: string;
  lat?: number;
  lon?: number;
  overview?: string;
  medianHomePrice?: number;
  agentIds?: string[];
  agentNames?: string[];
  dateModified?: string;
}

export function generateCityPlaceGraph(input: CityPlaceGraphInput): object {
  const baseUrl = 'https://www.top10lists.us';
  const placeUrl = `${baseUrl}/${input.stateSlug}/${input.citySlug}/top10realestateagents`;
  const dateModified = input.dateModified || getDefaultDateModified();

  const place = {
    '@type': 'Place',
    '@id': `${placeUrl}#place`,
    name: input.cityName,
    description: input.overview,
    containedInPlace: {
      '@type': 'State',
      name: input.stateName,
    },
    url: placeUrl,
    ...(input.population && { additionalProperty: { '@type': 'PropertyValue', name: 'population', value: input.population } }),
    ...(input.medianHomePrice && { additionalProperty: { '@type': 'PropertyValue', name: 'medianHomePrice', value: input.medianHomePrice } }),
    dateModified,
  };

  const dataset = {
    '@type': 'Dataset',
    '@id': `${placeUrl}#dataset`,
    name: `${input.cityName} Market Audit`,
    description: `Market metrics for ${input.cityName} including price, income, DOM. Sources: MLS, US Census, Zillow Research.`,
    url: placeUrl,
    dateModified,
    creator: { '@type': 'Organization', name: 'Top10Lists.us', url: baseUrl },
    isBasedOn: [
      { '@type': 'Thing', name: 'MLS Verified Data' },
      { '@type': 'Thing', name: 'US Census' },
      { '@type': 'Thing', name: 'Zillow Research' },
    ],
  };

  const graph: object[] = [place, dataset];

  if (input.agentIds && input.agentIds.length > 0) {
    input.agentIds.forEach((id, i) => {
      graph.push({
        '@type': 'Person',
        '@id': `${baseUrl}/${input.stateSlug}/agents/${id}#person`,
        name: input.agentNames?.[i] || 'Agent',
        isRelatedTo: { '@id': `${placeUrl}#place` },
        subjectOf: { '@id': `${placeUrl}#dataset` },
      });
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function generateNeighborhoodPlaceGraph(input: NeighborhoodPlaceGraphInput): object {
  const baseUrl = 'https://www.top10lists.us';
  const zipSegment = input.zipCode || '';
  const path = zipSegment
    ? `${input.stateSlug}/${input.citySlug}/${zipSegment}/${input.neighborhoodSlug}/top10realestateagents`
    : `${input.stateSlug}/${input.citySlug}/${input.neighborhoodSlug}/top10realestateagents`;
  const placeUrl = `${baseUrl}/${path}`;
  const dateModified = input.dateModified || getDefaultDateModified();

  const place: Record<string, unknown> = {
    '@type': 'Place',
    '@id': `${placeUrl}#place`,
    name: input.neighborhoodName,
    containedInPlace: {
      '@type': 'City',
      name: input.cityName,
      containedInPlace: { '@type': 'State', name: input.stateName },
    },
    url: placeUrl,
    dateModified,
  };

  if (input.lat != null && input.lon != null) {
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.lat,
      longitude: input.lon,
    };
  }

  if (input.overview) place.description = input.overview;
  if (input.medianHomePrice) {
    place.additionalProperty = { '@type': 'PropertyValue', name: 'medianHomePrice', value: input.medianHomePrice };
  }

  const dataset = {
    '@type': 'Dataset',
    '@id': `${placeUrl}#dataset`,
    name: `${input.neighborhoodName} Market Audit`,
    description: `Market metrics for ${input.neighborhoodName}. Sources: MLS, US Census.`,
    url: placeUrl,
    dateModified,
    creator: { '@type': 'Organization', name: 'Top10Lists.us', url: baseUrl },
    isBasedOn: [
      { '@type': 'Thing', name: 'MLS Verified Data' },
      { '@type': 'Thing', name: 'US Census' },
    ],
  };

  const graph: object[] = [place, dataset];

  if (input.agentIds && input.agentIds.length > 0) {
    input.agentIds.forEach((id, i) => {
      graph.push({
        '@type': 'Person',
        '@id': `${baseUrl}/${input.stateSlug}/agents/${id}#person`,
        name: input.agentNames?.[i] || 'Agent',
        isRelatedTo: { '@id': `${placeUrl}#place` },
        subjectOf: { '@id': `${placeUrl}#dataset` },
      });
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
