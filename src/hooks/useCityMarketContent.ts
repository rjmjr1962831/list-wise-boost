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

type MarketStatOverrides = Partial<Pick<CityMarketData,
  'pricePerSqFt' |
  'yearOverYearChange' |
  'inventoryLevel' |
  'marketType' |
  'averageHomeSize' |
  'homeownershipRate'
>>;

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePercentDecimal(n: number | undefined): number | undefined {
  if (n === undefined) return undefined;
  // If someone stores 4.2 meaning 4.2%, convert to 0.042
  if (Math.abs(n) > 1) return n / 100;
  return n;
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

  // Optional: overlay specific numeric market stats stored as individual keys.
  // This lets you update stats without regenerating the full city JSON blob.
  const { data: marketStatOverrides } = useQuery({
    queryKey: ['city-market-stats-overrides', citySlug],
    queryFn: async (): Promise<MarketStatOverrides> => {
      const { data, error } = await supabase
        .from('marketing_content')
        .select('key,value')
        .in('page', [`city-${citySlug}`, citySlug])
        .eq('section', 'market')
        .in('key', [
          'price_per_sqft',
          'yoy_price_change',
          'inventory_level',
          'market_type',
          'avg_home_size_sqft',
          'homeownership_rate',
        ])
        .limit(50);

      if (error || !data) return {};

      const byKey = new Map<string, string>();
      for (const row of data) byKey.set(row.key, row.value);

      const pricePerSqFt = toNumber(byKey.get('price_per_sqft'));
      const yearOverYearChange = normalizePercentDecimal(toNumber(byKey.get('yoy_price_change')));
      const averageHomeSize = toNumber(byKey.get('avg_home_size_sqft'));
      const homeownershipRate = normalizePercentDecimal(toNumber(byKey.get('homeownership_rate')));
      const inventoryLevel = byKey.get('inventory_level') || undefined;
      const marketType = byKey.get('market_type') || undefined;

      return {
        ...(pricePerSqFt !== undefined ? { pricePerSqFt } : {}),
        ...(yearOverYearChange !== undefined ? { yearOverYearChange } : {}),
        ...(averageHomeSize !== undefined ? { averageHomeSize } : {}),
        ...(homeownershipRate !== undefined ? { homeownershipRate } : {}),
        ...(inventoryLevel ? { inventoryLevel } : {}),
        ...(marketType ? { marketType } : {}),
      };
    },
    enabled: !!citySlug,
    staleTime: 1000 * 60 * 10,
  });

  // Get static data from arizonaCityMarketData
  const staticData = getCityMarketData(citySlug);
  const cityPricing = getCityBySlug(citySlug);

  // Merge generated content with static data, or use defaults
  const baseMarketData: CityMarketData = staticData
    ? {
        ...staticData,
        // If we have generated content, use it to override static defaults
        ...(generatedContent && {
          overview: generatedContent.overview || staticData.overview,
          highlights: generatedContent.highlights ?? staticData.highlights ?? [],
          neighborhoodTypes: generatedContent.neighborhoodTypes ?? staticData.neighborhoodTypes ?? [],
          buyerProfile: generatedContent.buyerProfile || staticData.buyerProfile,
          marketTrends: generatedContent.marketTrends || staticData.marketTrends,
          historicalFacts: generatedContent.historicalFacts ?? [],
          pointsOfInterest: generatedContent.pointsOfInterest ?? [],
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
      }
    : generatedContent
      ? {
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
          overview: generatedContent.overview || `${cityName} is a vibrant community in ${citySlug}.`,
          highlights: generatedContent.highlights ?? [],
          neighborhoodTypes: generatedContent.neighborhoodTypes ?? [],
          buyerProfile: generatedContent.buyerProfile || '',
          marketTrends: generatedContent.marketTrends || '',
          historicalFacts: generatedContent.historicalFacts ?? [],
          pointsOfInterest: generatedContent.pointsOfInterest ?? [],
          localCulture: generatedContent.localCulture,
          bestKeptSecret: generatedContent.bestKeptSecret,
        }
      : getDefaultCityMarketData(cityName, citySlug, cityPricing?.medianHomePrice);

  const marketData: CityMarketData = {
    ...baseMarketData,
    ...(marketStatOverrides ?? {}),
  };

  return {
    marketData,
    isLoading,
    hasGeneratedContent: !!generatedContent,
  };
}

