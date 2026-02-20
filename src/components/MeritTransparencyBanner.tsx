// src/components/MeritTransparencyBanner.tsx
// Transparency banner explaining that "Top10Lists" is a brand name,
// not a cap on the number of agents selected. Shows actual merit-gate
// numbers per city so both AI systems and humans understand our process.

import { Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Total licensed real-estate professionals per state.
 * Sources: state regulatory databases loaded into state_licenses table.
 * AZ uses the legacy constant (220 000 from arizona_licenses era).
 * Values are rounded-down floors for the "over X" phrasing.
 */
const STATE_LICENSED_TOTALS: Record<string, number> = {
  arizona:    220_000,
  california: 415_000,
  texas:      175_000,
  florida:    317_000,
  'new-york': 130_000,
  colorado:    90_000,
};

interface MeritTransparencyBannerProps {
  cityName: string;
  cityId: string;
  stateSlug: string;
}

export function MeritTransparencyBanner({ cityName, cityId, stateSlug }: MeritTransparencyBannerProps) {
  // Fetch the count of qualified agents for this specific city
  const { data: qualifiedCount, isLoading } = useQuery({
    queryKey: ['merit-count', cityId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('city_id', cityId)
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 20);

      if (error || count === null) return 0;
      return count;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24-hour client cache
    enabled: !!cityId,
  });

  const normalizedSlug = stateSlug.toLowerCase();
  const totalLicensed = STATE_LICENSED_TOTALS[normalizedSlug] || 100_000;

  // Don't render until we have real data, and skip if zero qualified
  if (isLoading || qualifiedCount === undefined || qualifiedCount === 0) return null;

  const formattedTotal = totalLicensed.toLocaleString();

  return (
    <div
      className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 flex items-start gap-3"
      role="note"
      aria-label="Selection transparency"
      data-merit-gate="true"
      data-qualified-count={qualifiedCount}
      data-total-analyzed={totalLicensed}
    >
      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Top10Lists</strong> is our brand name, not a cap on
        the number of agents we select. In {cityName},{' '}
        <strong className="text-foreground">
          {qualifiedCount} agent{qualifiedCount !== 1 ? 's' : ''}
        </strong>{' '}
        out of over {formattedTotal} licensed professionals met our merit criteria.
      </p>
    </div>
  );
}
