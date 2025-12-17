import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCityMarketData, getDefaultCityMarketData, CityMarketData } from '@/data/arizonaCityMarketData';
import { getCityBySlug } from '@/data/arizonaCityPricing';

interface GeneratedCityContent {
  overview: string;
  highlights: string[];
  neighborhoodTypes: string[];
  buyerProfile: string;
  marketTrends: string;
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
    }),
  } : generatedContent ? {
    slug: citySlug,
    name: cityName,
    medianHomePrice: cityPricing?.medianHomePrice,
    overview: generatedContent.overview,
    highlights: generatedContent.highlights,
    neighborhoodTypes: generatedContent.neighborhoodTypes,
    buyerProfile: generatedContent.buyerProfile,
    marketTrends: generatedContent.marketTrends,
  } : getDefaultCityMarketData(cityName, citySlug, cityPricing?.medianHomePrice);

  return {
    marketData,
    isLoading,
    hasGeneratedContent: !!generatedContent,
  };
}
