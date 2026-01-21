import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';

interface NeighborhoodExpertPageProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
  primaryZip?: string;
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
  neighborhoodName,
  primaryZip
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

  // Build qualified agents URL with ZIP when available (5-segment canonical format)
  const qualifiedAgentsUrl = primaryZip
    ? `/${stateSlug}/${citySlug}/${primaryZip}/${neighborhoodSlug}/qualified-real-estate-agents`
    : `/${stateSlug}/${citySlug}/${neighborhoodSlug}/qualified-real-estate-agents`;

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
    <div className="space-y-6">
      {/* Experts Display OR No Expert Message */}
      {experts.length > 0 ? (
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Neighborhood Expert{experts.length > 1 ? 's' : ''}: {neighborhoodName}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({experts.length} designated)
            </span>
          </div>
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
        <section className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            No Neighborhood Expert currently designated for {neighborhoodName}.
          </p>
          <Link 
            to={qualifiedAgentsUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            View all qualified agents serving {neighborhoodName} →
          </Link>
        </section>
      )}

      {/* Neighborhood Expert Explanation */}
      <div className="pt-4 border-t border-border">
        <details className="group text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1">
            <span>What is a Neighborhood Expert?</span>
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-3 pl-0 text-muted-foreground space-y-2 max-w-2xl">
            <p>
              The Neighborhood Expert designation represents additional diligence focused on sustained, neighborhood-specific experience.
            </p>
            <p>
              Designated experts undergo deeper area-specific evaluation and make an investment to support ongoing verification.
            </p>
            <Link 
              to="/about/ranking-methodology" 
              className="inline-block text-primary hover:underline mt-1"
            >
              View methodology
            </Link>
          </div>
        </details>

        {/* Show qualified agents link when experts exist (placed in the details area) */}
        {experts.length > 0 && (
          <Link 
            to={qualifiedAgentsUrl}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            View all qualified agents serving {neighborhoodName} →
          </Link>
        )}
      </div>
    </div>
  );
}
