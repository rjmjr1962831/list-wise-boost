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
    if (!professionalId) {
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
          console.warn(`No location could be derived for ${agentName}. Proceeding without it.`);
        }

        // Try direct Zillow profile scrape first for highest accuracy
        let resolvedStats: Partial<ZillowStats> | null = null;
        let zipCandidate: string | null = null;

        if (profileUrl && profileUrl.includes('zillow.com')) {
          const profileResp = await supabase.functions.invoke('fetch-zillow-profile-stats', {
            body: {
              profileUrl,
              agentName,
            }
          });

          if (profileResp.error) {
            console.warn('Zillow profile scrape error:', profileResp.error);
          } else {
            const ps = profileResp.data?.stats ?? profileResp.data;
            if (ps) {
              const partial: Partial<ZillowStats> = {};
              if (ps.forSale != null || ps.currentListings != null) partial.forSale = ps.forSale ?? ps.currentListings;
              const soldVal = ps.sold ?? ps.salesLast12Months ?? ps.salesLastYear ?? ps.totalSales;
              if (soldVal != null) partial.sold = soldVal;
              if (ps.forRent != null) partial.forRent = ps.forRent;
              const rev = ps.reviews ?? ps.totalReviews;
              if (rev != null) partial.reviews = rev;
              const cl = ps.currentListings ?? ps.forSale;
              if (cl != null) partial.currentListings = cl;
              if (ps.totalSales != null) partial.totalSales = ps.totalSales;
              if (ps.yearsExperience != null) partial.yearsExperience = ps.yearsExperience;

              if (Object.keys(partial).length > 0) {
                resolvedStats = partial;
              }
              zipCandidate = ps.zipCode ?? zipCandidate;
            }
          }
        }

        // Fallback: Apify-based agent stats if profile scrape didn't return
        // COMMENTED OUT: Using jupri/zillow-agents instead of getdataforme
        /*
        if (!resolvedStats) {
          const apifyResp = await supabase.functions.invoke('fetch-getdataforme-agent-stats', {
            body: {
              profileUrl,
              zipcode: zipCode ?? undefined,
              location: zipCode ? undefined : locationParam,
              agentName,
            }
          });

          if (apifyResp.error) {
            console.error('GetDataForMe error:', apifyResp.error);
            throw apifyResp.error;
          }

          if (apifyResp.data?.success && apifyResp.data.stats) {
            const s = apifyResp.data.stats;
            const partial: Partial<ZillowStats> = {};
            if (s.currentListings != null) {
              partial.currentListings = s.currentListings;
              partial.forSale = s.currentListings;
            }
            const soldVal = s.salesLastYear ?? s.totalSales;
            if (soldVal != null) partial.sold = soldVal;
            if (s.totalSales != null) partial.totalSales = s.totalSales;
            if (s.totalReviews != null) partial.reviews = s.totalReviews;
            if (s.yearsExperience != null) partial.yearsExperience = s.yearsExperience;

            if (Object.keys(partial).length > 0) {
              resolvedStats = partial;
            }
            zipCandidate = s.zipCode ?? zipCandidate;
          }
        }
        */

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
          if (zipCandidate && !zipCode) {
            const { error: zipErr } = await supabase
              .from('professionals')
              .update({ zip_code: zipCandidate })
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
