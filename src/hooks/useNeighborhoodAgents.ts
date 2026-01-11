import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Professional } from '@/types/professional';

interface NeighborhoodAgent extends Professional {
  isPaidExpert: boolean;
  distanceMiles?: number;
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
        // Step 1: Get neighborhood from catalog to find primary ZIP
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

        const primaryZip = neighborhood.zips?.[0];
        if (!primaryZip) {
          console.log('[useNeighborhoodAgents] No ZIP codes for neighborhood:', neighborhoodSlug);
          setAgents([]);
          setLoading(false);
          return;
        }

        // Step 2: Get all adjacent ZIPs within 10 miles
        const { data: adjacentZips, error: zipError } = await supabase
          .from('zip_adjacency')
          .select('adjacent_zip, distance_miles')
          .eq('zip_code', primaryZip);

        if (zipError) {
          console.error('[useNeighborhoodAgents] Error fetching adjacent ZIPs:', zipError);
        }

        // Create a map of ZIP -> distance (primary ZIP = 0)
        const zipDistanceMap: Record<string, number> = { [primaryZip]: 0 };
        (adjacentZips || []).forEach(({ adjacent_zip, distance_miles }) => {
          zipDistanceMap[adjacent_zip] = Number(distance_miles);
        });

        const allZips = Object.keys(zipDistanceMap);
        console.log(`[useNeighborhoodAgents] Found ${allZips.length} ZIPs near ${neighborhoodSlug} (primary: ${primaryZip})`);

        // Step 3: Get paid experts for this neighborhood
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

        // Step 4: Query professionals whose office ZIP is in our list
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
          console.error('[useNeighborhoodAgents] Error fetching professionals:', profsError);
          setError('Failed to load agents');
          setLoading(false);
          return;
        }

        console.log(`[useNeighborhoodAgents] Found ${professionals?.length || 0} agents in nearby ZIPs`);

        // Step 5: Map to NeighborhoodAgent with isPaidExpert and distance
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
          // New fields
          isPaidExpert: paidExpertIds.has(prof.id),
          distanceMiles: zipDistanceMap[prof.zip_code] ?? undefined,
        }));

        // Step 6: Sort - Paid experts first, then by distance
        mappedAgents.sort((a, b) => {
          // Paid experts always come first
          if (a.isPaidExpert && !b.isPaidExpert) return -1;
          if (!a.isPaidExpert && b.isPaidExpert) return 1;
          
          // Among same category, sort by distance (closer first)
          const distA = a.distanceMiles ?? 999;
          const distB = b.distanceMiles ?? 999;
          return distA - distB;
        });

        // Step 7: Return all agents (no pagination)
        setTotalCount(mappedAgents.length);
        setAgents(mappedAgents);
        console.log(`[useNeighborhoodAgents] Returning all ${mappedAgents.length} qualified agents`);
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
