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

export const useZillowStats = (
  professionalId: string | undefined, 
  profileUrl: string | null, 
  agentName: string,
  zipCode: string | null
) => {
  const [stats, setStats] = useState<ZillowStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!professionalId || !profileUrl || !profileUrl.includes('zillow.com')) {
      return;
    }

    const fetchAndStoreStats = async () => {
      setLoading(true);

      try {
        // Prepare location: prefer zipCode; else derive from route (/state_slug/city_slug)
        const locationParam = zipCode ?? (() => {
          try {
            const parts = window.location.pathname.split('/').filter(Boolean);
            const stateSlug = parts[0]?.toUpperCase();
            const citySlug = parts[1];
            if (stateSlug && citySlug) {
              const city = citySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return `${city}, ${stateSlug}`;
            }
          } catch {}
          return null;
        })();

        if (!locationParam) {
          console.warn(`No location could be derived for ${agentName}.`);
          return;
        }

        const { data, error } = await supabase.functions.invoke('fetch-getdataforme-agent-stats', {
          body: {
            profileUrl,
            zipcode: zipCode ?? undefined,
            location: zipCode ? undefined : locationParam,
            agentName,
          }
        });
        
        if (error) {
          console.error('GetDataForMe error:', error);
          throw error;
        }

        let resolvedStats: Partial<ZillowStats> | null = null;
        
        if (data?.success && data.stats) {
          resolvedStats = {
            forSale: data.stats.currentListings ?? 0,
            sold: (data.stats.salesLastYear ?? data.stats.totalSales ?? 0),
            forRent: 0,
            reviews: data.stats.totalReviews ?? 0,
            currentListings: data.stats.currentListings ?? 0,
            totalSales: data.stats.totalSales ?? 0,
            yearsExperience: data.stats.yearsExperience ?? 0,
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

          // Backfill zip code if available and missing
          if (data?.stats?.zipCode && !zipCode) {
            const { error: zipErr } = await supabase
              .from('professionals')
              .update({ zip_code: data.stats.zipCode })
              .eq('id', professionalId);
            if (zipErr) {
              console.error('Error updating zip code:', zipErr);
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
  }, [professionalId, profileUrl, agentName, zipCode]);

  return { stats, loading };
};
