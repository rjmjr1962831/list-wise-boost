import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';

interface VerifiedExpertsSectionProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
}

export function VerifiedExpertsSection({ 
  neighborhoodSlug, 
  citySlug, 
  stateSlug,
  neighborhoodName 
}: VerifiedExpertsSectionProps) {
  const [experts, setExperts] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        // First, get the neighborhood ID from the catalog
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('id')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhoodError || !neighborhood) {
          console.log('[VerifiedExperts] Neighborhood not found:', neighborhoodSlug);
          setLoading(false);
          return;
        }

        // Query active subscriptions for this neighborhood with professional data
        const { data: subscriptions, error: subError } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select(`
            professional_id,
            professionals (
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
            )
          `)
          .eq('neighborhood_id', neighborhood.id)
          .eq('is_active', true);

        if (subError) {
          console.error('[VerifiedExperts] Error fetching subscriptions:', subError);
          setLoading(false);
          return;
        }

        // Extract and filter active professionals, map to Professional type
        const activeExperts = (subscriptions || [])
          .map((sub: any) => sub.professionals)
          .filter((prof: any) => prof && prof.active === true)
          .map((prof: any): Professional => ({
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
          }));

        console.log(`[VerifiedExperts] Found ${activeExperts.length} verified experts for ${neighborhoodName}`);
        setExperts(activeExperts);
      } catch (error) {
        console.error('[VerifiedExperts] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperts();
  }, [neighborhoodSlug, citySlug, neighborhoodName]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  if (experts.length === 0) {
    return null; // Don't show section if no verified experts
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Verified Neighborhood Experts</h2>
        <Badge variant="secondary" className="ml-2">
          {experts.length} Expert{experts.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        These agents have been verified as specialists in {neighborhoodName} with proven local expertise.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert, index) => (
          <AgentBadge 
            key={expert.id} 
            professional={expert}
            stateSlug={stateSlug}
            citySlug={citySlug}
            rank={index + 1}
            accentColor="primary"
          />
        ))}
      </div>
    </div>
  );
}
