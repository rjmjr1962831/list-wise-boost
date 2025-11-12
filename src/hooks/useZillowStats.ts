import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZillowStats {
  forSale: number;
  sold: number;
  forRent: number;
  reviews: number;
  currentListings: number;
  totalSales: number;
  yearsExperience: number;
}

export const useZillowStats = (professionalId: string | undefined, profileUrl: string | null, agentName: string) => {
  const [stats, setStats] = useState<ZillowStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!professionalId || !profileUrl || !profileUrl.includes('zillow.com')) {
      return;
    }

    const fetchAndStoreStats = async () => {
      setLoading(true);

      try {
        // Use Apify actor to fetch Zillow stats
        const { data, error } = await supabase.functions.invoke('fetch-apify-agent-stats', {
          body: { profileUrl }
        });
        
        if (error) throw error;

        let resolvedStats: Partial<ZillowStats> | null = null;
        
        if (data?.success && data.stats) {
          resolvedStats = {
            forSale: data.stats.forSale,
            sold: data.stats.sold,
            forRent: data.stats.forRent,
            reviews: data.stats.reviews,
            currentListings: data.stats.currentListings,
            totalSales: data.stats.totalSales,
            yearsExperience: data.stats.yearsExperience,
          };
        }

        // If Apify returned no meaningful stats, fall back to Outscraper
        const isMeaningful = (s: Partial<ZillowStats> | null) => !!s && (
          (s.currentListings ?? 0) > 0 || (s.forSale ?? 0) > 0 || (s.totalSales ?? 0) > 0 || (s.sold ?? 0) > 0
        );
        
        if (!isMeaningful(resolvedStats)) {
          const { data: fallback, error: fbErr } = await supabase.functions.invoke('fetch-outscraper-agent-stats', {
            body: { profileUrl }
          });
          if (!fbErr && fallback?.success && fallback.stats) {
            resolvedStats = {
              forSale: fallback.stats.forSale,
              sold: fallback.stats.sold,
              forRent: fallback.stats.forRent,
              reviews: fallback.stats.reviews,
              currentListings: fallback.stats.currentListings,
              totalSales: fallback.stats.totalSales,
              yearsExperience: fallback.stats.yearsExperience,
            };
          }
        }

        if (resolvedStats) {
          setStats(resolvedStats as ZillowStats);

          // Store the stats in the database only if we have meaningful values (> 0)
          const newCurrent = (resolvedStats as ZillowStats).currentListings || (resolvedStats as ZillowStats).forSale || 0;
          const newTotal = (resolvedStats as ZillowStats).totalSales || (resolvedStats as ZillowStats).sold || 0;

          if (newCurrent > 0 || newTotal > 0) {
            const { error: updateError } = await supabase
              .from('professionals')
              .update({
                current_listings: newCurrent,
                total_sales: newTotal,
              })
              .eq('id', professionalId);

            if (updateError) {
              console.error('Error updating professional stats:', updateError);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching Zillow stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndStoreStats();
  }, [professionalId, profileUrl, agentName]);

  return { stats, loading };
};
