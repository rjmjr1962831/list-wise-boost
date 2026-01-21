import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNeighborhoodMarketStats } from '@/hooks/useNeighborhoodMarketStats';
import { NeighborhoodMarketStatsCard } from '@/components/NeighborhoodMarketStatsCard';
interface NearbyNeighborhood {
  id: string;
  slug: string;
  name: string;
  tier: "Main" | "Prime" | "Luxury";
  city_area: string;
  distance_miles: number;
}

interface NeighborhoodData {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: string;
  median_home_value: number | null;
  median_income: number | null;
  zips: string[] | null;
  lat: number | null;
  lon: number | null;
  writeup_html: string | null;
  nearby_neighborhoods: NearbyNeighborhood[] | null;
}

interface NeighborhoodOverviewProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
}

const formatCurrency = (value: number | null): string => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const getTierBadgeVariant = (tier: string): "default" | "secondary" | "outline" => {
  switch (tier?.toLowerCase()) {
    case 'luxury':
      return 'default';
    case 'prime':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getTierDisplayName = (tier: string): string => {
  switch (tier?.toLowerCase()) {
    case 'luxury':
      return 'Luxury Market';
    case 'prime':
      return 'Prime Market';
    case 'main':
      return 'Main Market';
    default:
      return tier || 'Market';
  }
};

export function NeighborhoodOverview({ neighborhoodSlug, citySlug, stateSlug }: NeighborhoodOverviewProps) {
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  // Fetch enriched market stats from marketing_content
  const { data: marketStats, isLoading: marketStatsLoading } = useNeighborhoodMarketStats(neighborhoodSlug);

  useEffect(() => {
    const fetchNeighborhood = async () => {
      if (!neighborhoodSlug || !citySlug) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('neighborhood_catalog')
          .select('*')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('[NeighborhoodOverview] Error fetching neighborhood:', error);
        } else if (data) {
          // Cast nearby_neighborhoods from JSON to typed array
          const typedData: NeighborhoodData = {
            ...data,
            nearby_neighborhoods: (data.nearby_neighborhoods as unknown) as NearbyNeighborhood[] | null,
          };
          setNeighborhood(typedData);
        }
      } catch (err) {
        console.error('[NeighborhoodOverview] Exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNeighborhood();
  }, [neighborhoodSlug, citySlug]);

  if (loading) {
    return (
      <Card className="mb-8 animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!neighborhood) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Neighborhood Facts Bar - Clean horizontal layout */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Neighborhood:</span>
          <span className="font-medium text-foreground">{neighborhood.neighborhood}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {getTierDisplayName(neighborhood.tier)}
          </span>
        </div>
        
        {neighborhood.median_home_value && (
          <div>
            <span className="text-sm text-muted-foreground">Median Home: </span>
            <span className="font-medium text-foreground">{formatCurrency(neighborhood.median_home_value)}</span>
          </div>
        )}

        {neighborhood.median_income && (
          <div>
            <span className="text-sm text-muted-foreground">Median Income: </span>
            <span className="font-medium text-foreground">{formatCurrency(neighborhood.median_income)}</span>
          </div>
        )}

        {neighborhood.zips && neighborhood.zips.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">ZIP: </span>
            <span className="font-medium text-foreground">
              {neighborhood.zips.slice(0, 3).join(', ')}
              {neighborhood.zips.length > 3 && ` +${neighborhood.zips.length - 3}`}
            </span>
          </div>
        )}
      </div>

      {/* About Section - Separate, clean collapsible */}
      {(neighborhood.writeup_html || neighborhood.tier) && (
        <Collapsible open={isAboutOpen} onOpenChange={setIsAboutOpen}>
          <div className="py-3 border-b border-border">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span>About {neighborhood.neighborhood}</span>
                {isAboutOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="py-4">
              {neighborhood.writeup_html ? (
                <div 
                  className="prose prose-sm max-w-none text-muted-foreground [&_p]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: neighborhood.writeup_html }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {neighborhood.neighborhood} is a neighborhood in {neighborhood.city_area}, {neighborhood.state}.
                  {neighborhood.tier === 'Luxury' && ' This is one of the most prestigious areas in the region.'}
                  {neighborhood.tier === 'Prime' && ' This is a highly sought-after area with strong property values.'}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Market Statistics Card - Enriched data from marketing_content */}
      {marketStats && <NeighborhoodMarketStatsCard stats={marketStats} />}
    </div>
  );
}
