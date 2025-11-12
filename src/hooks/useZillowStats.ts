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
        // Try direct Zillow scraper first, then fall back to Apify
        let resolvedStats: Partial<ZillowStats> | null = null;
        
        // 1) Direct Zillow profile scraper
        const { data: directData, error: directErr } = await supabase.functions.invoke('fetch-zillow-profile-stats', {
          body: { profileUrl, agentName }
        });
        
        if (!directErr && directData?.success && directData.stats) {
          resolvedStats = {
            forSale: directData.stats.forSale ?? directData.stats.currentListings ?? 0,
            sold: directData.stats.sold ?? directData.stats.totalSales ?? 0,
            forRent: directData.stats.forRent ?? 0,
            reviews: directData.stats.reviews ?? 0,
            currentListings: directData.stats.currentListings ?? directData.stats.forSale ?? 0,
            totalSales: directData.stats.totalSales ?? directData.stats.sold ?? 0,
            yearsExperience: directData.stats.yearsExperience ?? 0,
          };
        }
        
        // 2) Fallback to Apify actor if needed
        if (!resolvedStats) {
          const { data: apifyData, error: apifyErr } = await supabase.functions.invoke('fetch-apify-agent-stats', {
            body: { profileUrl }
          });
          
          if (!apifyErr && apifyData?.success && apifyData.stats) {
            resolvedStats = apifyData.stats as any;
          } else if (apifyErr) {
            throw apifyErr;
          }
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
