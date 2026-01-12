import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Search, Users } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';

interface VerifiedExpertsSectionProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
  onFocusAgentSearch?: () => void;
}

export function VerifiedExpertsSection({ 
  neighborhoodSlug, 
  citySlug, 
  stateSlug,
  neighborhoodName,
  onFocusAgentSearch
}: VerifiedExpertsSectionProps) {
  const [experts, setExperts] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('id')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhoodError || !neighborhood) {
          setLoading(false);
          return;
        }

        const { data: subscriptions, error: subError } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select(`
            professional_id,
            professionals (
              id, name, company, title, image_url, review_stars_rating,
              num_total_reviews, years_experience, phone, email, website,
              license_number, synthesized_bio, specialty, canonical_slug, active, license_verified_at
            )
          `)
          .eq('neighborhood_id', neighborhood.id)
          .eq('is_active', true);

        if (subError) {
          setLoading(false);
          return;
        }

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
            stats: { yearsExperience: prof.years_experience || undefined },
            verified: !!prof.license_verified_at,
            image: prof.image_url || '',
            license_number: prof.license_number || undefined,
            license_verified_at: prof.license_verified_at || undefined,
            years_experience: prof.years_experience || undefined,
          }));

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

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Verified Neighborhood Experts</h2>
        <Badge variant="secondary" className="ml-2">
          {experts.length} Expert{experts.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      {experts.length > 0 ? (
        <>
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
        </>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
          <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            No verified neighborhood experts are featured here yet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={onFocusAgentSearch}>
              <Search className="h-4 w-4 mr-2" />
              Check an agent by name
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/${stateSlug}/${citySlug}/${neighborhoodSlug}/qualified-real-estate-agents`}>
                <Users className="h-4 w-4 mr-2" />
                View qualified agents near {neighborhoodName}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
