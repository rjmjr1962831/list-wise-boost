import { useSearchParams, Link } from 'react-router-dom';
import { AgentBadge } from '@/components/AgentBadge';
import { useNeighborhoodAgents } from '@/hooks/useNeighborhoodAgents';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NeighborhoodAgentListProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
}

export function NeighborhoodAgentList({
  neighborhoodSlug,
  citySlug,
  stateSlug,
  neighborhoodName
}: NeighborhoodAgentListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 10;

  const { agents, loading, error, totalCount, hasMore } = useNeighborhoodAgents({
    neighborhoodSlug,
    citySlug,
    stateSlug,
    page,
    pageSize
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const paidExpertCount = agents.filter(a => a.isPaidExpert).length;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setSearchParams({ page: String(newPage) });
    // Scroll to top of agent list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <Users className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">
          No agents with offices near {neighborhoodName} found yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Check back soon as we expand our coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">
            Real Estate Agents Near {neighborhoodName}
          </h2>
          <span className="text-sm text-muted-foreground">
            ({totalCount} agent{totalCount !== 1 ? 's' : ''})
          </span>
        </div>
        {paidExpertCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {paidExpertCount} verified expert{paidExpertCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent, index) => (
          <AgentBadge
            key={agent.id}
            professional={agent}
            stateSlug={stateSlug}
            citySlug={citySlug}
            rank={agent.rank}
            accentColor={agent.isPaidExpert ? "primary" : "turquoise"}
            isPaidExpert={agent.isPaidExpert}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={!hasMore}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Explanation text */}
      <p className="text-xs text-muted-foreground text-center">
        Agents are ranked by office proximity to {neighborhoodName}. 
        All agents have 4.8+ ratings and 20+ verified reviews.
      </p>
    </div>
  );
}
