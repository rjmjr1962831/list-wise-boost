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
        // Fetch stats directly from Zillow profile
        let resolvedStats: Partial<ZillowStats> | null = null;
        
        const { data, error: functionError } = await supabase.functions.invoke('fetch-zillow-profile-stats', {
          body: { profileUrl, agentName }
        });
        
        if (functionError) throw functionError;
        
        if (data?.success && data.stats) {
          resolvedStats = data.stats as ZillowStats;
        }

        if (resolvedStats) {
          setStats(resolvedStats as ZillowStats);

          // Store the stats in the database
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              current_listings: (resolvedStats as ZillowStats).currentListings || (resolvedStats as ZillowStats).forSale || 0,
              total_sales: (resolvedStats as ZillowStats).totalSales || (resolvedStats as ZillowStats).sold || 0,
            })
            .eq('id', professionalId);

          if (updateError) {
            console.error('Error updating professional stats:', updateError);
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
