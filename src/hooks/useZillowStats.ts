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
        // Fetch stats from Zillow
        const { data, error: functionError } = await supabase.functions.invoke('fetch-zillow-profile-stats', {
          body: { profileUrl, agentName }
        });

        if (functionError) throw functionError;

        if (data?.success && data.stats) {
          const fetchedStats = data.stats;
          setStats(fetchedStats);

          // Store the stats in the database
          const { error: updateError } = await supabase
            .from('professionals')
            .update({
              current_listings: fetchedStats.currentListings || fetchedStats.forSale,
              total_sales: fetchedStats.totalSales || fetchedStats.sold,
              zuid: data.zuid
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
