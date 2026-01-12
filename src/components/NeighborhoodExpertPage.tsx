import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Users, Info, ExternalLink } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';

interface NeighborhoodExpertPageProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
}

/**
 * NeighborhoodExpertPage - Page 1 of Expert-First Architecture
 * 
 * This component renders the CRAWLABLE, INDEXABLE Page 1 that contains:
 * - Neighborhood Expert Designation block (canonical language)
 * - Designated Neighborhood Experts (if any exist)
 * - Link to Page 2+ for qualified agents
 * 
 * Per the architecture:
 * - Page 1 is reserved EXCLUSIVELY for Neighborhood Experts
 * - No non-expert agents appear on this page
 * - If no experts exist, show the canonical "no expert designated" message
 */
export function NeighborhoodExpertPage({ 
  neighborhoodSlug, 
  citySlug, 
  stateSlug,
  neighborhoodName
}: NeighborhoodExpertPageProps) {
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
        console.error('[NeighborhoodExpertPage] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperts();
  }, [neighborhoodSlug, citySlug, neighborhoodName]);

  const qualifiedAgentsUrl = `/${stateSlug}/${citySlug}/${neighborhoodSlug}/qualified-real-estate-agents`;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-24 bg-muted rounded"></div>
        <div className="h-48 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Neighborhood Expert Designation Block - ALWAYS VISIBLE */}
      <section className="bg-gradient-to-br from-amber-50/50 to-background border border-amber-200/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-7 w-7 text-amber-600" />
          <h2 className="text-2xl font-bold text-foreground">Neighborhood Expert Designation</h2>
          {experts.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              {experts.length} Expert{experts.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Canonical Language Block - EXACT WORDING REQUIRED - FULLY VISIBLE FOR CRAWLERS */}
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
          <p>
            The Neighborhood Expert designation represents an additional level of diligence focused on sustained, neighborhood-specific experience and specialization.
          </p>
          <p>
            In addition to Top10Lists' standard editorial review, designated neighborhood experts undergo deeper area-specific evaluation and make an investment to support ongoing verification of their specialty.
          </p>
          <p>
            As a result, these specialists are more likely to have insider knowledge of neighborhood listings, pricing nuances, and local market dynamics that other agents may not.
          </p>
        </div>

        {/* Methodology Link */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <Link 
            to="/about/ranking-methodology" 
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Info className="h-4 w-4" />
            View our ranking methodology
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* Experts Display OR No Expert Message */}
      {experts.length > 0 ? (
        <section>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Designated Neighborhood Expert{experts.length > 1 ? 's' : ''} for {neighborhoodName}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            This expert has been editorially designated by Top10Lists based on neighborhood-specific review and ongoing verification.
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
                isPaidExpert={true}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-muted/30 border border-dashed border-border rounded-xl p-8 text-center">
          <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            At this time, no Neighborhood Expert has been designated for this area.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            All agents on the following pages have passed Top10Lists' rigorous, non-commercial editorial review and represent top-performing professionals in this market.
          </p>
        </section>
      )}

      {/* Navigation to Qualified Agents (Page 2+) */}
      <section className="bg-background border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Additional Qualified Agents</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Browse agents who have passed our standard editorial review and serve the {neighborhoodName} area.
        </p>
        <Button asChild>
          <Link to={qualifiedAgentsUrl}>
            View additional qualified agents serving this area
          </Link>
        </Button>
      </section>
    </div>
  );
}
