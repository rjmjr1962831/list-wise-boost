import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Professional } from '@/types/professional';

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
          .select('id, primary_zip, zips, nearby_neighborhoods')
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
        if (licenseNumbers.length === 0) {
          console.log('[useAreaAgents] No agents found in area');
          setAgents([]);
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
            specialty,
            canonical_slug,
            active,
            license_verified_at
          `)
          .eq('active', true)
          .gte('review_stars_rating', 4.8)
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
            specialties: prof.specialty || [],
            address: '',
            phone: prof.phone || '',
            email: prof.email || '',
            website: prof.website || '',
            description: prof.synthesized_bio || '',
            stats: {
              yearsExperience: prof.years_experience || undefined,
            },
            verified: !!prof.license_verified_at,
            image: prof.image_url || '',
            license_number: prof.license_number || undefined,
            license_verified_at: prof.license_verified_at || undefined,
            years_experience: prof.years_experience || undefined,
            canonical_slug: prof.canonical_slug,
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
