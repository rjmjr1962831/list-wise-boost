import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Professional } from '@/types/professional';
import { filterSpecialties } from '@/lib/utils';

interface AreaAgent extends Professional {
  isPaidExpert: boolean;
  neighborhoodTransactions?: number;
  transactionZips?: string[];
  distanceMiles?: number;
}

interface UseAreaAgentsResult {
  agents: AreaAgent[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

interface UseAreaAgentsParams {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  radiusMiles?: number;
}

/**
 * Hook to fetch agents in a geographic area around a neighborhood
 * Uses zip_adjacency table to find agents within specified radius
 */
export function useAreaAgents({
  neighborhoodSlug,
  citySlug,
  stateSlug,
  radiusMiles = 1.5
}: UseAreaAgentsParams): UseAreaAgentsResult {
  const [agents, setAgents] = useState<AreaAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchAreaAgents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Get neighborhood and its primary ZIP
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('id, primary_zip, zips, nearby_neighborhoods, city_area, city_area_slug')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhoodError || !neighborhood) {
          console.log('[useAreaAgents] Neighborhood not found:', neighborhoodSlug);
          setAgents([]);
          setLoading(false);
          return;
        }
        
        // Define metro area cities for filtering
        const PHOENIX_METRO = ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'gilbert', 'glendale', 'peoria', 'surprise', 'goodyear', 'avondale', 'buckeye', 'queen-creek', 'paradise-valley', 'fountain-hills', 'cave-creek', 'carefree'];
        const TUCSON_METRO = ['tucson', 'oro-valley', 'marana', 'sahuarita', 'south-tucson'];
        const FLAGSTAFF_METRO = ['flagstaff', 'sedona', 'cottonwood', 'camp-verde'];
        
        // Determine which metro this neighborhood belongs to
        const cityLower = citySlug.toLowerCase();
        let metroCities: string[] = [];
        if (PHOENIX_METRO.includes(cityLower)) {
          metroCities = PHOENIX_METRO;
        } else if (TUCSON_METRO.includes(cityLower)) {
          metroCities = TUCSON_METRO;
        } else if (FLAGSTAFF_METRO.includes(cityLower)) {
          metroCities = FLAGSTAFF_METRO;
        } else {
          // Default to the specific city only
          metroCities = [cityLower];
        }

        const primaryZip = neighborhood.primary_zip || neighborhood.zips?.[0];
        if (!primaryZip) {
          console.log('[useAreaAgents] No primary ZIP for neighborhood');
          setAgents([]);
          setLoading(false);
          return;
        }

        console.log(`[useAreaAgents] Finding agents within ${radiusMiles} miles of ${primaryZip}`);

        // Step 2: Get paid experts for this neighborhood (to flag/filter on page 2)
        const { data: subscriptions, error: subError } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select('professional_id')
          .eq('neighborhood_id', neighborhood.id)
          .eq('is_active', true);

        if (subError) {
          console.error('[useAreaAgents] Error fetching subscriptions:', subError);
        }

        const paidExpertIds = new Set((subscriptions || []).map((s: any) => s.professional_id));

        // Step 3: Get adjacent ZIPs within radius
        const { data: adjacentZips, error: adjacencyError } = await supabase
          .from('zip_adjacency')
          .select('adjacent_zip, distance_miles')
          .eq('zip_code', primaryZip)
          .lte('distance_miles', radiusMiles);

        if (adjacencyError) {
          console.error('[useAreaAgents] Error fetching adjacent zips:', adjacencyError);
        }

        // Build map of ZIP -> distance
        const zipDistanceMap: Record<string, number> = { [primaryZip]: 0 };
        (adjacentZips || []).forEach(({ adjacent_zip, distance_miles }) => {
          zipDistanceMap[adjacent_zip] = Number(distance_miles);
        });

        const allZips = Object.keys(zipDistanceMap);
        console.log(`[useAreaAgents] Found ${allZips.length} ZIPs within ${radiusMiles} miles`);

        // Step 3: Get all agents with transactions in these ZIPs
        const { data: activities, error: activityError } = await supabase
          .from('agent_zip_activity')
          .select('license_number, zip_code, transaction_count')
          .in('zip_code', allZips);

        if (activityError) {
          console.error('[useAreaAgents] Error fetching agent activity:', activityError);
          setError('Failed to load agents');
          setLoading(false);
          return;
        }

        // Group by license number
        const agentActivityMap: Record<string, { totalTx: number; zips: string[]; minDistance: number }> = {};
        (activities || []).forEach(({ license_number, zip_code, transaction_count }) => {
          if (!agentActivityMap[license_number]) {
            agentActivityMap[license_number] = { totalTx: 0, zips: [], minDistance: Infinity };
          }
          agentActivityMap[license_number].totalTx += transaction_count;
          agentActivityMap[license_number].zips.push(zip_code);
          const distance = zipDistanceMap[zip_code] ?? Infinity;
          if (distance < agentActivityMap[license_number].minDistance) {
            agentActivityMap[license_number].minDistance = distance;
          }
        });

        const licenseNumbers = Object.keys(agentActivityMap);
        
        // FALLBACK: If no transaction-based agents, query top-rated agents from metro area
        if (licenseNumbers.length === 0) {
          console.log('[useAreaAgents] No transaction data - falling back to metro-based search for:', metroCities);
          
          // Get all ZIPs for the metro area cities
          const { data: metroNeighborhoods, error: metroError } = await supabase
            .from('neighborhood_catalog')
            .select('primary_zip, zips')
            .in('city_area_slug', metroCities)
            .eq('is_active', true);
          
          if (metroError) {
            console.error('[useAreaAgents] Metro neighborhoods query error:', metroError);
          }
          
          // Collect all metro ZIP codes
          const metroZips = new Set<string>();
          (metroNeighborhoods || []).forEach((n: any) => {
            if (n.primary_zip) metroZips.add(n.primary_zip);
            if (n.zips) n.zips.forEach((z: string) => metroZips.add(z));
          });
          
          const metroZipArray = Array.from(metroZips);
          console.log(`[useAreaAgents] Found ${metroZipArray.length} ZIPs in metro area`);
          
          // Query agents with business_zip in metro area - FILTER BY STATE to prevent cross-state pollution
          const { data: fallbackAgents, error: fallbackError } = await supabase
            .from('professionals')
            .select(`
              id,
              name,
              company,
              title,
              image_url,
              review_stars_rating,
              num_total_reviews,
              years_experience,
              phone,
              email,
              website,
              license_number,
              synthesized_bio,
              get_to_know_me,
              description,
              specialty,
              canonical_slug,
              active,
              license_verified_at,
              business_city,
              business_zip,
              state_slug,
              agent_sales_stats,
              sales_count_all_time,
              sales_count_last_year,
              average_value_3yr,
              price_range_3yr_min,
              price_range_3yr_max,
              selection_rationale,
              community_roles,
              notable_achievements,
              current_tier,
              zillow_profile_url
            `)
            .eq('active', true)
            .eq('state_slug', stateSlug) // CRITICAL: Filter by state to prevent cross-state agents
            .gte('review_stars_rating', 4.5)
            .gte('num_total_reviews', 20)
            .order('num_total_reviews', { ascending: false })
            .limit(100);

          if (fallbackError) {
            console.error('[useAreaAgents] Fallback query error:', fallbackError);
            setAgents([]);
            setLoading(false);
            return;
          }
          
          // Filter to agents in metro area (by business_zip or business_city)
          // State filtering is already done in query above
          const metroAgents = (fallbackAgents || []).filter((prof: any) => {
            // Check if business_zip is in metro
            if (prof.business_zip && metroZipArray.includes(prof.business_zip)) {
              return true;
            }
            // Check if business_city matches metro cities
            if (prof.business_city) {
              const citySlugified = prof.business_city.toLowerCase().replace(/\s+/g, '-');
              return metroCities.includes(citySlugified);
            }
            // Include agent even without location data - state filter already applied in query
            return true;
          }).slice(0, 50);

          const fallbackMapped: AreaAgent[] = metroAgents.map((prof: any) => ({
            id: prof.id,
            rank: 0,
            name: prof.name,
            company: prof.company || '',
            rating: prof.review_stars_rating || 0,
            reviews: prof.num_total_reviews || 0,
            specialties: filterSpecialties(prof.specialty || []),
            address: '',
            phone: prof.phone || '',
            email: prof.email || '',
            website: prof.website || '',
            description: prof.synthesized_bio || '',
            get_to_know_me: prof.get_to_know_me || undefined,
            original_description: prof.description || undefined,
            synthesized_bio: prof.synthesized_bio || undefined,
            stats: {
              yearsExperience: prof.years_experience || undefined,
            },
            verified: !!prof.license_verified_at,
            image: prof.image_url || '',
            license_number: prof.license_number || undefined,
            license_verified_at: prof.license_verified_at || undefined,
            years_experience: prof.years_experience || undefined,
            canonical_slug: prof.canonical_slug,
            state_slug: prof.state_slug, // Include state_slug for correct profile links
            // Sales stats for GEO
            agent_sales_stats: prof.agent_sales_stats || null,
            sales_count_all_time: prof.sales_count_all_time || null,
            average_value_3yr: prof.average_value_3yr || null,
            price_range_3yr_min: prof.price_range_3yr_min || null,
            price_range_3yr_max: prof.price_range_3yr_max || null,
            selection_rationale: prof.selection_rationale || null,
            community_roles: prof.community_roles || null,
            notable_achievements: prof.notable_achievements || null,
            current_tier: prof.current_tier || 'listed',
            zillow_profile_url: prof.zillow_profile_url || null,
            isPaidExpert: paidExpertIds.has(prof.id),
            neighborhoodTransactions: 0,
            transactionZips: [],
            distanceMiles: undefined,
          }));

          setTotalCount(fallbackMapped.length);
          setAgents(fallbackMapped);
          console.log(`[useAreaAgents] Fallback returned ${fallbackMapped.length} agents`);
          setLoading(false);
          return;
        }

        // Step 4: Fetch professional details for these agents
        const { data: professionals, error: profsError } = await supabase
          .from('professionals')
          .select(`
            id,
            name,
            company,
            title,
            image_url,
            review_stars_rating,
            num_total_reviews,
            years_experience,
            phone,
            email,
            website,
            license_number,
            synthesized_bio,
            get_to_know_me,
            description,
            specialty,
            canonical_slug,
            active,
            license_verified_at,
            state_slug,
            agent_sales_stats,
            sales_count_all_time,
            sales_count_last_year,
            average_value_3yr,
            price_range_3yr_min,
            price_range_3yr_max,
            selection_rationale,
            community_roles,
            notable_achievements,
            current_tier,
            zillow_profile_url
          `)
          .eq('active', true)
          .eq('state_slug', stateSlug) // CRITICAL: Filter by state to prevent cross-state agents
          .gte('review_stars_rating', 4.5)
          .gte('num_total_reviews', 20)
          .in('license_number', licenseNumbers);

        if (profsError) {
          console.error('[useAreaAgents] Error fetching professionals:', profsError);
          setError('Failed to load agent details');
          setLoading(false);
          return;
        }

        // Step 5: Map to AreaAgent type
        const mappedAgents: AreaAgent[] = (professionals || []).map((prof: any) => {
          const activity = agentActivityMap[prof.license_number] || { totalTx: 0, zips: [], minDistance: 0 };
          return {
            id: prof.id,
            rank: 0,
            name: prof.name,
            company: prof.company || '',
            rating: prof.review_stars_rating || 0,
            reviews: prof.num_total_reviews || 0,
            specialties: filterSpecialties(prof.specialty || []),
            address: '',
            phone: prof.phone || '',
            email: prof.email || '',
            website: prof.website || '',
            description: prof.synthesized_bio || '',
            get_to_know_me: prof.get_to_know_me || undefined,
            original_description: prof.description || undefined,
            synthesized_bio: prof.synthesized_bio || undefined,
            stats: {
              yearsExperience: prof.years_experience || undefined,
            },
            verified: !!prof.license_verified_at,
            image: prof.image_url || '',
            license_number: prof.license_number || undefined,
            license_verified_at: prof.license_verified_at || undefined,
            years_experience: prof.years_experience || undefined,
            canonical_slug: prof.canonical_slug,
            state_slug: prof.state_slug, // Include state_slug for correct profile links
            // Sales stats for GEO
            agent_sales_stats: prof.agent_sales_stats || null,
            sales_count_all_time: prof.sales_count_all_time || null,
            average_value_3yr: prof.average_value_3yr || null,
            price_range_3yr_min: prof.price_range_3yr_min || null,
            price_range_3yr_max: prof.price_range_3yr_max || null,
            selection_rationale: prof.selection_rationale || null,
            community_roles: prof.community_roles || null,
            notable_achievements: prof.notable_achievements || null,
            current_tier: prof.current_tier || 'listed',
            zillow_profile_url: prof.zillow_profile_url || null,
            isPaidExpert: paidExpertIds.has(prof.id),
            neighborhoodTransactions: activity.totalTx,
            transactionZips: activity.zips,
            distanceMiles: activity.minDistance,
          };
        });

        // Step 6: Sort by transactions (more = higher rank)
        mappedAgents.sort((a, b) => {
          const txA = a.neighborhoodTransactions ?? 0;
          const txB = b.neighborhoodTransactions ?? 0;
          return txB - txA;
        });

        setTotalCount(mappedAgents.length);
        setAgents(mappedAgents);
        console.log(`[useAreaAgents] Returning ${mappedAgents.length} agents in ${radiusMiles}-mile radius`);

      } catch (err) {
        console.error('[useAreaAgents] Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (neighborhoodSlug && citySlug) {
      fetchAreaAgents();
    }
  }, [neighborhoodSlug, citySlug, stateSlug, radiusMiles]);

  return {
    agents,
    loading,
    error,
    totalCount
  };
}
