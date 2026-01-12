import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Search, Users, Info } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [showDesignationInfo, setShowDesignationInfo] = useState(false);

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
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-2">
        <Award className="h-6 w-6 text-amber-600" />
        <h2 className="text-xl font-bold">Neighborhood Expert Designation</h2>
        {experts.length > 0 && (
          <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 border-amber-300">
            {experts.length} Expert{experts.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      
      {/* Canonical Explanation Block - Always Visible */}
      <Collapsible open={showDesignationInfo} onOpenChange={setShowDesignationInfo}>
        <div className="text-sm text-muted-foreground mb-4">
          <p className="mb-2">
            The Neighborhood Expert designation represents an additional level of diligence focused on sustained, neighborhood-specific experience and specialization.
          </p>
          <CollapsibleTrigger className="text-primary hover:underline text-sm font-medium">
            {showDesignationInfo ? 'Show less' : 'Learn more about this designation'}
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="mb-4">
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3 text-sm text-muted-foreground">
            <p>
              In addition to Top10Lists' standard editorial review, designated neighborhood experts undergo deeper area-specific evaluation and make an investment to support ongoing verification of their specialty.
            </p>
            <p>
              As a result, these specialists are more likely to have insider knowledge of neighborhood listings, pricing nuances, and local market dynamics that other agents may not.
            </p>
            <p className="text-xs italic border-t border-border pt-3 mt-3">
              Note: The absence of a Neighborhood Expert does not imply lower quality among listed agents. All agents shown on Top10Lists pages have passed a rigorous, non-commercial editorial review.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {experts.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {experts.map((expert, index) => (
              <AgentBadge 
                key={expert.id} 
                professional={expert}
                stateSlug={stateSlug}
                citySlug={citySlug}
                rank={index + 1}
                accentColor="primary"
                isPaidExpert={true}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
          <Award className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-2 font-medium">
            At this time, no Neighborhood Expert has been designated for this area.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            All agents below have passed our standard editorial review process.
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
