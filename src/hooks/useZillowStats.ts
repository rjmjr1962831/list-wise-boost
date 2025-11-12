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
        // Use GetDataForMe scraper for complete agent data
        const { data, error } = await supabase.functions.invoke('fetch-getdataforme-agent-stats', {
          body: { profileUrl }
        });
        
        if (error) {
          console.error('GetDataForMe error:', error);
          throw error;
        }

        let resolvedStats: Partial<ZillowStats> | null = null;
        
        if (data?.success && data.stats) {
          resolvedStats = {
            forSale: 0,
            sold: data.stats.totalSales || 0,
            forRent: 0,
            reviews: data.stats.totalReviews || 0,
            currentListings: 0, // Not provided by scraped/zillow-agent-scraper
            totalSales: data.stats.totalSales || 0,
            yearsExperience: 0, // Not provided by scraped/zillow-agent-scraper
          };
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
