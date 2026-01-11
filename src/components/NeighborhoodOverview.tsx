import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Home, DollarSign, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
          setNeighborhood(data);
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
    <Card className="mb-8 border-primary/20 bg-gradient-to-br from-card to-card/80">
      <CardContent className="p-6">
        {/* Header with neighborhood name and tier badge */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              {neighborhood.neighborhood}
            </h2>
          </div>
          <Badge variant={getTierBadgeVariant(neighborhood.tier)}>
            {getTierDisplayName(neighborhood.tier)}
          </Badge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {/* Median Home Value */}
          {neighborhood.median_home_value && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Median Home Value</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(neighborhood.median_home_value)}
                </p>
              </div>
            </div>
          )}

          {/* Median Income */}
          {neighborhood.median_income && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Median Household Income</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(neighborhood.median_income)}
                </p>
              </div>
            </div>
          )}

          {/* ZIP Codes */}
          {neighborhood.zips && neighborhood.zips.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">ZIP Codes</p>
                <p className="text-lg font-semibold text-foreground">
                  {neighborhood.zips.slice(0, 3).join(', ')}
                  {neighborhood.zips.length > 3 && ` +${neighborhood.zips.length - 3} more`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Location context */}
        <p className="text-sm text-muted-foreground mt-4">
          {neighborhood.neighborhood} is a neighborhood in {neighborhood.city_area}, {neighborhood.state}.
          {neighborhood.tier === 'Luxury' && ' This is one of the most prestigious areas in the region.'}
          {neighborhood.tier === 'Prime' && ' This is a highly sought-after area with strong property values.'}
        </p>
      </CardContent>
    </Card>
  );
}
