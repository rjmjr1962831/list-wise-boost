import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { useAreaAgents } from '@/hooks/useAreaAgents';
import { AgentBadge } from '@/components/AgentBadge';
import { Button } from '@/components/ui/button';
import { Users, ChevronLeft, ChevronRight, ArrowLeft, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationDisclaimer } from '@/components/VerificationDisclaimer';

const AGENTS_PER_PAGE = 10;
const SEARCH_RADIUS_MILES = 1.5;

interface NeighborhoodData {
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  primary_zip: string | null;
}

/**
 * AreaAgentsPage - Shows agents operating within a geographic radius
 * 
 * This page displays agents who have verified transactions in ZIP codes
 * within 1.5 miles of the target neighborhood. Paginated at 10 per page.
 */
export default function AreaAgentsPage() {
  const { stateSlug, citySlug, neighborhoodSlug } = useParams<{
    stateSlug: string;
    citySlug: string;
    neighborhoodSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [neighborhoodLoading, setNeighborhoodLoading] = useState(true);

  // Get page from URL params, default to 1
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Scroll to top on page load or page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);

  // Fetch neighborhood data
  useEffect(() => {
    const fetchNeighborhood = async () => {
      if (!neighborhoodSlug || !citySlug) {
        setNeighborhoodLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('neighborhood_catalog')
          .select('neighborhood, neighborhood_slug, city_area, city_area_slug, state, primary_zip')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && data) {
          setNeighborhood(data);
        }
      } catch (err) {
        console.error('[AreaAgentsPage] Error:', err);
      } finally {
        setNeighborhoodLoading(false);
      }
    };

    fetchNeighborhood();
  }, [neighborhoodSlug, citySlug]);

  // Fetch area agents
  const { agents, loading: agentsLoading, error, totalCount } = useAreaAgents({
    neighborhoodSlug: neighborhoodSlug || '',
    citySlug: citySlug || '',
    stateSlug: stateSlug || '',
    radiusMiles: SEARCH_RADIUS_MILES
  });

  const totalPages = Math.ceil(agents.length / AGENTS_PER_PAGE);
  
  // Get agents for current page
  const startIndex = (currentPage - 1) * AGENTS_PER_PAGE;
  const endIndex = startIndex + AGENTS_PER_PAGE;
  const pageAgents = agents.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setSearchParams({ page: page.toString() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loading = neighborhoodLoading || agentsLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !neighborhood) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Unable to load agents for this area.</p>
          <Button asChild variant="outline">
            <Link to={`/${stateSlug}/${citySlug}`}>Return to {citySlug}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Build qualified agents page URL
  // Build qualified agents URL (4-segment format without ZIP)
  const qualifiedAgentsUrl = `/${stateSlug}/${citySlug}/${neighborhoodSlug}/qualified-real-estate-agents`;

  return (
    <>
      <SafeHead>
        {/* NOINDEX - This page is not for AI crawling */}
        <title>{`Top Agents Near ${neighborhood.neighborhood}, ${neighborhood.city_area} | Page ${currentPage}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="description" content={`Find top real estate agents operating within ${SEARCH_RADIUS_MILES} miles of ${neighborhood.neighborhood}. Page ${currentPage} of ${totalPages}.`} />
      </SafeHead>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-gradient-to-b from-muted/50 to-background py-8">
          <div className="container mx-auto px-4">
            {/* Back to Qualified Agents Page */}
            <Link 
              to={qualifiedAgentsUrl}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Qualified Agents
            </Link>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold">
                  Top Agents in the {neighborhood.neighborhood} Area
                </h1>
              </div>
            </div>
            
            <p className="text-muted-foreground max-w-3xl">
              Agents with verified transactions within {SEARCH_RADIUS_MILES} miles of {neighborhood.neighborhood}, ranked by activity.
            </p>
            
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground mt-2">
                Page {currentPage} of {totalPages} • {totalCount} agents found
              </p>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4">
          <VerificationDisclaimer />
        </div>

        {/* Agent Grid */}
        <div className="container mx-auto px-4 pb-8">
          {pageAgents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No agents found within {SEARCH_RADIUS_MILES} miles of this area.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to={qualifiedAgentsUrl}>View Qualified Agents</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 pt-6">
                {pageAgents.map((agent) => (
                  <AgentBadge
                    key={agent.id}
                    professional={agent}
                    stateSlug={(agent as any).state_slug || stateSlug || ''}
                    citySlug={citySlug || ''}
                    accentColor="turquoise"
                    isPaidExpert={false}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Footer note */}
          <p className="text-xs text-center text-muted-foreground mt-8">
            Agents listed are ranked by verified transaction activity in the area.
          </p>
        </div>
      </div>
    </>
  );
}
