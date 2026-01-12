import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Professional } from '@/types/professional';

interface NeighborhoodAgent extends Professional {
  isPaidExpert: boolean;
  neighborhoodTransactions?: number;
  transactionZips?: string[];
}

interface UseNeighborhoodAgentsResult {
  agents: NeighborhoodAgent[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

interface UseNeighborhoodAgentsParams {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
}

export function useNeighborhoodAgents({
  neighborhoodSlug,
  citySlug,
  stateSlug
}: UseNeighborhoodAgentsParams): UseNeighborhoodAgentsResult {
  const [agents, setAgents] = useState<NeighborhoodAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Get neighborhood from catalog
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('id, zips')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhoodError || !neighborhood) {
          console.log('[useNeighborhoodAgents] Neighborhood not found:', neighborhoodSlug);
          setAgents([]);
          setLoading(false);
          return;
        }

        console.log(`[useNeighborhoodAgents] Found neighborhood: ${neighborhoodSlug} with ${neighborhood.zips?.length || 0} ZIPs`);

        // Step 2: Get paid experts for this neighborhood
        const { data: subscriptions, error: subError } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select('professional_id')
          .eq('neighborhood_id', neighborhood.id)
          .eq('is_active', true);

        if (subError) {
          console.error('[useNeighborhoodAgents] Error fetching subscriptions:', subError);
        }

        const paidExpertIds = new Set((subscriptions || []).map(s => s.professional_id));
        console.log(`[useNeighborhoodAgents] Found ${paidExpertIds.size} paid experts`);

        // Step 3: Call the transaction-based function
        const { data: transactionAgents, error: rpcError } = await supabase.rpc(
          'get_neighborhood_active_agents',
          { p_neighborhood_id: neighborhood.id }
        );

        if (rpcError) {
          console.error('[useNeighborhoodAgents] Error calling get_neighborhood_active_agents:', rpcError);
          // Fall back to the old method if function fails
          await fallbackToOldMethod(neighborhood, paidExpertIds, setAgents, setTotalCount);
          setLoading(false);
          return;
        }

        console.log(`[useNeighborhoodAgents] Transaction-based query returned ${transactionAgents?.length || 0} agents`);

        // Step 4: Map to NeighborhoodAgent
        const mappedAgents: NeighborhoodAgent[] = (transactionAgents || []).map((agent: any) => ({
          id: agent.professional_id,
          rank: 0,
          name: agent.agent_name || '',
          company: agent.company || '',
          rating: agent.review_stars_rating || 0,
          reviews: agent.num_total_reviews || 0,
          specialties: agent.specialty || [],
          address: '',
          phone: agent.phone || '',
          email: agent.email || '',
          website: agent.website || '',
          description: agent.synthesized_bio || '',
          stats: {
            yearsExperience: agent.years_experience || undefined,
          },
          verified: !!agent.license_verified_at,
          image: agent.image_url || '',
          license_number: agent.license_number || undefined,
          license_verified_at: agent.license_verified_at || undefined,
          years_experience: agent.years_experience || undefined,
          canonical_slug: agent.canonical_slug,
          // Transaction-based fields
          isPaidExpert: paidExpertIds.has(agent.professional_id),
          neighborhoodTransactions: agent.neighborhood_transactions,
          transactionZips: agent.transaction_zips,
        }));

        // Step 5: Sort - Paid experts first, then by transaction count
        mappedAgents.sort((a, b) => {
          // Paid experts always come first
          if (a.isPaidExpert && !b.isPaidExpert) return -1;
          if (!a.isPaidExpert && b.isPaidExpert) return 1;
          
          // Among same category, sort by transaction count (more = higher)
          const txA = a.neighborhoodTransactions ?? 0;
          const txB = b.neighborhoodTransactions ?? 0;
          return txB - txA;
        });

        setTotalCount(mappedAgents.length);
        setAgents(mappedAgents);
        console.log(`[useNeighborhoodAgents] Returning ${mappedAgents.length} agents sorted by verified transactions`);

      } catch (err) {
        console.error('[useNeighborhoodAgents] Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (neighborhoodSlug && citySlug) {
      fetchAgents();
    }
  }, [neighborhoodSlug, citySlug, stateSlug]);

  return {
    agents,
    loading,
    error,
    totalCount
  };
}

// Fallback to office-location based matching if transaction data not available
async function fallbackToOldMethod(
  neighborhood: { id: string; zips: string[] | null },
  paidExpertIds: Set<string>,
  setAgents: (agents: NeighborhoodAgent[]) => void,
  setTotalCount: (count: number) => void
) {
  console.log('[useNeighborhoodAgents] Falling back to office-location method');
  
  const primaryZip = neighborhood.zips?.[0];
  if (!primaryZip) {
    console.log('[useNeighborhoodAgents] No ZIP codes for neighborhood');
    setAgents([]);
    return;
  }

  // Get adjacent ZIPs
  const { data: adjacentZips } = await supabase
    .from('zip_adjacency')
    .select('adjacent_zip, distance_miles')
    .eq('zip_code', primaryZip);

  const zipDistanceMap: Record<string, number> = { [primaryZip]: 0 };
  (adjacentZips || []).forEach(({ adjacent_zip, distance_miles }) => {
    zipDistanceMap[adjacent_zip] = Number(distance_miles);
  });

  const allZips = Object.keys(zipDistanceMap);

  // Query professionals by office ZIP
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
      license_verified_at,
      zip_code
    `)
    .eq('active', true)
    .gte('review_stars_rating', 4.8)
    .gte('num_total_reviews', 20)
    .in('zip_code', allZips);

  if (profsError) {
    console.error('[useNeighborhoodAgents] Fallback query error:', profsError);
    setAgents([]);
    return;
  }

  const mappedAgents: NeighborhoodAgent[] = (professionals || []).map((prof: any) => ({
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
  }));

  mappedAgents.sort((a, b) => {
    if (a.isPaidExpert && !b.isPaidExpert) return -1;
    if (!a.isPaidExpert && b.isPaidExpert) return 1;
    return (b.reviews || 0) - (a.reviews || 0);
  });

  setTotalCount(mappedAgents.length);
  setAgents(mappedAgents);
  console.log(`[useNeighborhoodAgents] Fallback: Returning ${mappedAgents.length} agents`);
}
