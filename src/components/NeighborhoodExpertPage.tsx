import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, Users } from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import { Professional } from '@/types/professional';
import { Link } from 'react-router-dom';
import { useAreaAgents } from '@/hooks/useAreaAgents';
import { Skeleton } from '@/components/ui/skeleton';

interface NeighborhoodExpertPageProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
  primaryZip?: string;
}

const DISPLAY_AGENT_COUNT = 10;

/**
 * NeighborhoodExpertPage - Displays neighborhood experts first, 
 * then 10 qualified agents in round-robin order serving the area.
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

  // Fetch qualified agents using the area agents hook
  const { agents: areaAgents, loading: agentsLoading } = useAreaAgents({
    neighborhoodSlug,
    citySlug,
    stateSlug,
    radiusMiles: 5, // Broader radius for agents doing business in area
  });

  // Filter out paid experts and apply round-robin ordering
  const qualifiedAgents = useMemo(() => {
    const nonExperts = areaAgents.filter(a => !a.isPaidExpert);
    
    // Round-robin: use hourly offset for fair rotation
    const hourlyOffset = Math.floor(Date.now() / (1000 * 60 * 60)) % Math.max(nonExperts.length, 1);
    const rotated = [...nonExperts.slice(hourlyOffset), ...nonExperts.slice(0, hourlyOffset)];
    
    return rotated.slice(0, DISPLAY_AGENT_COUNT);
  }, [areaAgents]);

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
              license_number, synthesized_bio, specialty, canonical_slug, active, license_verified_at,
              agent_sales_stats, sales_count_all_time, average_value_3yr, price_range_3yr_min, price_range_3yr_max
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
          .map((prof: any) => ({
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
            canonical_slug: prof.canonical_slug,
            // Sales stats for GEO
            agent_sales_stats: prof.agent_sales_stats || null,
            sales_count_all_time: prof.sales_count_all_time || null,
            average_value_3yr: prof.average_value_3yr || null,
            price_range_3yr_min: prof.price_range_3yr_min || null,
            price_range_3yr_max: prof.price_range_3yr_max || null,
          } as Professional & Record<string, any>));

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

  // Generate ItemList JSON-LD schema with full agent details for GEO optimization
  const agentItemListSchema = useMemo(() => {
    const allAgents = [...experts, ...qualifiedAgents];
    if (allAgents.length === 0) return null;

    const stateAbbrev = stateSlug.toUpperCase().substring(0, 2);
    const cityName = citySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const pageUrl = primaryZip
      ? `https://www.top10lists.us/${stateSlug}/${citySlug}/${primaryZip}/${neighborhoodSlug}/top10realestateagents`
      : `https://www.top10lists.us/${stateSlug}/${citySlug}/${neighborhoodSlug}/top10realestateagents`;

    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Top Real Estate Agents in ${neighborhoodName}, ${cityName}, ${stateAbbrev}`,
      "description": `Ranked list of top-rated real estate agents serving ${neighborhoodName}, ${cityName}. Verified by Top10Lists.us.`,
      "url": pageUrl,
      "numberOfItems": allAgents.length,
      "dateModified": new Date().toISOString().split('T')[0],
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "itemListElement": allAgents.map((agent, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "RealEstateAgent",
          "name": agent.name,
          "image": agent.image || undefined,
          "url": `https://www.top10lists.us/${stateSlug}/${citySlug}/top10realestateagents#agent-${agent.id}`,
          "telephone": agent.phone || undefined,
          "description": `Ranked #${index + 1} real estate agent in ${neighborhoodName}, ${cityName}. ${agent.stats?.yearsExperience ? `${agent.stats.yearsExperience} years experience.` : ''} Verified by Top10Lists.us.`,
          ...(agent.company && {
            "parentOrganization": {
              "@type": "RealEstateAgent",
              "name": agent.company
            }
          }),
          ...(agent.rating > 0 && {
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": agent.rating.toString(),
              "reviewCount": (agent.reviews || 0).toString(),
              "bestRating": "5",
              "worstRating": "1"
            }
          }),
          ...(agent.license_number && {
            "identifier": {
              "@type": "PropertyValue",
              "propertyID": "license",
              "value": agent.license_number
            }
          }),
          "areaServed": {
            "@type": "Place",
            "name": `${neighborhoodName}, ${cityName}, ${stateAbbrev}`
          },
          "memberOf": {
            "@type": "Organization",
            "name": "Top10Lists.us"
          }
        }
      }))
    };
  }, [experts, qualifiedAgents, neighborhoodName, stateSlug, citySlug, neighborhoodSlug, primaryZip]);

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
    <>
      {/* GEO: ItemList schema with full agent details for AI discovery */}
      {agentItemListSchema && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(agentItemListSchema)}
          </script>
        </Helmet>
      )}
      
      <div className="space-y-8">
      {/* Section 1: Dedicated Neighborhood Expert Space - Always visible */}
      <section className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Featured Position
          </span>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Neighborhood Expert{experts.length !== 1 ? 's' : ''}: {neighborhoodName}
        </h2>
        
        {experts.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {experts.length} designated expert{experts.length !== 1 ? 's' : ''} with verified neighborhood-specific experience.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
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
            <div className="mt-4">
              <Link
                to={`/neighborhood/apply?state=${stateSlug}&city=${citySlug}&zip=${primaryZip || ''}&neighborhood=${neighborhoodSlug}`}
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
              >
                <span className="mr-1">→</span>
                Think you belong here? Click here
              </Link>
            </div>
          </>
        ) : (
          <div className="py-4">
            <p className="text-muted-foreground mb-2">
              No Neighborhood Expert designated yet for {neighborhoodName}.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              This featured position is available for agents with proven expertise in this area.
            </p>
            <Link
              to={`/neighborhood/apply?state=${stateSlug}&city=${citySlug}&zip=${primaryZip || ''}&neighborhood=${neighborhoodSlug}`}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
            >
              <span className="mr-1">→</span>
              Think you belong here? Click here
            </Link>
          </div>
        )}
      </section>

      {/* Section 2: Qualified Agents (10 in round-robin order) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Top Agents Serving {neighborhoodName}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Editorially selected agents with verified activity in this area. This is not a ranking.
        </p>

        {agentsLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : qualifiedAgents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {qualifiedAgents.map((agent) => (
              <AgentBadge
                key={agent.id}
                professional={agent}
                stateSlug={stateSlug}
                citySlug={citySlug}
                accentColor="turquoise"
                isPaidExpert={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No qualified agents with verified activity in {neighborhoodName} found yet.
          </p>
        )}

        {/* Link to full qualified agents page for more */}
        {qualifiedAgents.length > 0 && (
          <div className="mt-6">
            <Link 
              to={qualifiedAgentsUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              View all qualified agents serving {neighborhoodName} →
            </Link>
          </div>
        )}
      </section>

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
      </div>
    </div>
    </>
  );
}
