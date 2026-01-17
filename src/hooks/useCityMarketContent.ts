import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCityMarketData, getDefaultCityMarketData, CityMarketData } from '@/data/arizonaCityMarketData';
import { getCityBySlug } from '@/data/arizonaCityPricing';

interface MarketStats {
  population?: number;
  medianHomePrice?: number;
  medianRent?: number;
  medianHouseholdIncome?: number;
  daysOnMarket?: number;
  pricePerSqFt?: number;
  yearOverYearChange?: number;
  inventoryLevel?: string;
  marketType?: string;
  averageHomeSize?: number;
  homeownershipRate?: number;
  rentToIncomeRatio?: number;
  rentalVacancyRate?: number;
  pctRenterOccupied?: number;
}

interface GeneratedCityContent {
  overview: string;
  highlights: string[];
  neighborhoodTypes: string[];
  buyerProfile: string;
  marketTrends: string;
  historicalFacts?: string[];
  pointsOfInterest?: string[];
  localCulture?: string;
  bestKeptSecret?: string;
  marketStats?: MarketStats;
}

export function useCityMarketContent(citySlug: string, cityName: string) {
  // First check for pre-generated content in database
  const { data: generatedContent, isLoading } = useQuery({
    queryKey: ['city-market-content', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_content')
        .select('value')
        .eq('page', `city-${citySlug}`)
        .eq('section', 'market_overview')
        .eq('key', 'full_content')
        .single();
      
      if (error || !data?.value) {
        return null;
      }
      
      try {
        return JSON.parse(data.value) as GeneratedCityContent;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Get static data from arizonaCityMarketData
  const staticData = getCityMarketData(citySlug);
  const cityPricing = getCityBySlug(citySlug);
  
  // Merge generated content with static data, or use defaults
  const marketData: CityMarketData = staticData ? {
    ...staticData,
    // If we have generated content, use it to override static defaults
    ...(generatedContent && {
      overview: generatedContent.overview,
      highlights: generatedContent.highlights,
      neighborhoodTypes: generatedContent.neighborhoodTypes,
      buyerProfile: generatedContent.buyerProfile,
      marketTrends: generatedContent.marketTrends,
      historicalFacts: generatedContent.historicalFacts,
      pointsOfInterest: generatedContent.pointsOfInterest,
      localCulture: generatedContent.localCulture,
      bestKeptSecret: generatedContent.bestKeptSecret,
    }),
    // Override static stats with enriched marketStats if available
    ...(generatedContent?.marketStats && {
      medianHomePrice: generatedContent.marketStats.medianHomePrice,
      medianHouseholdIncome: generatedContent.marketStats.medianHouseholdIncome,
      population: generatedContent.marketStats.population,
      daysOnMarket: generatedContent.marketStats.daysOnMarket,
      pricePerSqFt: generatedContent.marketStats.pricePerSqFt,
      yearOverYearChange: generatedContent.marketStats.yearOverYearChange,
      inventoryLevel: generatedContent.marketStats.inventoryLevel,
      marketType: generatedContent.marketStats.marketType,
      averageHomeSize: generatedContent.marketStats.averageHomeSize,
      homeownershipRate: generatedContent.marketStats.homeownershipRate,
      rentToIncomeRatio: generatedContent.marketStats.rentToIncomeRatio,
      medianRent: generatedContent.marketStats.medianRent,
      rentalVacancyRate: generatedContent.marketStats.rentalVacancyRate,
      pctRenterOccupied: generatedContent.marketStats.pctRenterOccupied,
    }),
  } : generatedContent ? {
    slug: citySlug,
    name: cityName,
    medianHomePrice: generatedContent.marketStats?.medianHomePrice ?? cityPricing?.medianHomePrice,
    medianHouseholdIncome: generatedContent.marketStats?.medianHouseholdIncome,
    population: generatedContent.marketStats?.population,
    daysOnMarket: generatedContent.marketStats?.daysOnMarket,
    pricePerSqFt: generatedContent.marketStats?.pricePerSqFt,
    yearOverYearChange: generatedContent.marketStats?.yearOverYearChange,
    inventoryLevel: generatedContent.marketStats?.inventoryLevel,
    marketType: generatedContent.marketStats?.marketType,
    averageHomeSize: generatedContent.marketStats?.averageHomeSize,
    homeownershipRate: generatedContent.marketStats?.homeownershipRate,
    rentToIncomeRatio: generatedContent.marketStats?.rentToIncomeRatio,
    medianRent: generatedContent.marketStats?.medianRent,
    rentalVacancyRate: generatedContent.marketStats?.rentalVacancyRate,
    pctRenterOccupied: generatedContent.marketStats?.pctRenterOccupied,
    overview: generatedContent.overview,
    highlights: generatedContent.highlights,
    neighborhoodTypes: generatedContent.neighborhoodTypes,
    buyerProfile: generatedContent.buyerProfile,
    marketTrends: generatedContent.marketTrends,
    historicalFacts: generatedContent.historicalFacts,
    pointsOfInterest: generatedContent.pointsOfInterest,
    localCulture: generatedContent.localCulture,
    bestKeptSecret: generatedContent.bestKeptSecret,
  } : getDefaultCityMarketData(cityName, citySlug, cityPricing?.medianHomePrice);

  return {
    marketData,
    isLoading,
    hasGeneratedContent: !!generatedContent,
  };
}
