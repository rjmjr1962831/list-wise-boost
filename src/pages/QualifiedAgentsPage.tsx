import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { useAreaAgents } from '@/hooks/useAreaAgents';
import { AgentBadge } from '@/components/AgentBadge';
import { Button } from '@/components/ui/button';
import { Users, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const AGENTS_PER_PAGE = 10;
const SEARCH_RADIUS_MILES = 1.5;

interface NeighborhoodData {
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
}

/**
 * QualifiedAgentsPage - Page 2+ of the Expert-First Architecture
 * 
 * This page displays qualified, non-expert agents who have passed 
 * Top10Lists' rigorous editorial review. It is:
 * - Noindex (not crawlable by search engines or AI)
 * - Paginated at 10 agents per page
 * - Accessible via navigation from Page 1
 */
export default function QualifiedAgentsPage() {
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

  // Always scroll to top on page load or page change
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
          .select('neighborhood, neighborhood_slug, city_area, city_area_slug, state')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && data) {
          setNeighborhood(data);
        }
      } catch (err) {
        console.error('[QualifiedAgentsPage] Error:', err);
      } finally {
        setNeighborhoodLoading(false);
      }
    };

    fetchNeighborhood();
  }, [neighborhoodSlug, citySlug]);

  // Fetch agents with verified transactions in nearby ZIPs (≈ nearby neighborhoods)
  const { agents, loading: agentsLoading, error, totalCount } = useAreaAgents({
    neighborhoodSlug: neighborhoodSlug || '',
    citySlug: citySlug || '',
    stateSlug: stateSlug || '',
    radiusMiles: SEARCH_RADIUS_MILES,
  });

  // Keep Page 1 expert-only contract: exclude paid experts from this page
  const qualifiedAgents = agents.filter((a: any) => !a.isPaidExpert);
  const totalPages = Math.ceil(qualifiedAgents.length / AGENTS_PER_PAGE);

  // Get agents for current page
  const startIndex = (currentPage - 1) * AGENTS_PER_PAGE;
  const endIndex = startIndex + AGENTS_PER_PAGE;
  const pageAgents = qualifiedAgents.slice(startIndex, endIndex);

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

  const expertPageUrl = `/${stateSlug}/${citySlug}/${neighborhoodSlug}/top10realestateagents`;

  return (
    <>
      <SafeHead>
        {/* NOINDEX - This page is not for AI crawling */}
        <title>{`Qualified Agents in ${neighborhood?.neighborhood || 'Area'}, ${neighborhood?.city_area || 'City'} | Page ${currentPage}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="description" content={`Browse qualified real estate agents serving ${neighborhood?.neighborhood || 'this area'}. Page ${currentPage} of ${totalPages}.`} />
      </SafeHead>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-gradient-to-b from-muted/50 to-background py-8">
          <div className="container mx-auto px-4">
            {/* Back to Expert Page */}
            <Link 
              to={expertPageUrl}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Neighborhood Expert page
            </Link>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold">
                  Top Real Estate Professionals Serving {neighborhood.neighborhood}
                </h1>
              </div>
              <Link 
                to="/about/ranking-methodology" 
                className="text-sm text-primary hover:underline hidden md:inline-flex"
              >
                [ Methodology ]
              </Link>
            </div>
            
            <p className="text-muted-foreground max-w-3xl">
              Qualified agents with verified transactions in nearby neighborhoods.
            </p>
            
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground mt-2">
                Page {currentPage} of {totalPages} • {qualifiedAgents.length} qualified agents
              </p>
            )}
            
            <Link 
              to="/about/ranking-methodology" 
              className="text-sm text-primary hover:underline mt-2 md:hidden"
            >
              [ Methodology ]
            </Link>
          </div>
        </div>

        {/* Context Section */}
        <div className="container mx-auto px-4 pt-8">
          <div className="bg-muted/20 border border-border rounded-lg p-5 mb-6">
            <p className="text-sm text-muted-foreground">
              Top-rated agents who meet our editorial standards for {neighborhood.neighborhood} and surrounding areas.
            </p>
          </div>
        </div>

        {/* Agent Grid */}
        <div className="container mx-auto px-4 pb-8">
          {pageAgents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No qualified agents found in nearby neighborhoods.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
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

          {/* Optional footer note */}
          <p className="text-xs text-center text-muted-foreground mt-8">
            Neighborhood Expert designations, when present, are displayed separately on the primary neighborhood page.
          </p>
        </div>
      </div>
    </>
  );
}
