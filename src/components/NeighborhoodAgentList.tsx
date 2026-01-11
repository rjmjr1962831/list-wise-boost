import { AgentBadge } from '@/components/AgentBadge';
import { useNeighborhoodAgents } from '@/hooks/useNeighborhoodAgents';
import { Users } from 'lucide-react';
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
  const { agents, loading, error, totalCount } = useNeighborhoodAgents({
    neighborhoodSlug,
    citySlug,
    stateSlug
  });

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
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">
          Real Estate Agents Near {neighborhoodName}
        </h2>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <AgentBadge
            key={agent.id}
            professional={agent}
            stateSlug={stateSlug}
            citySlug={citySlug}
            accentColor={agent.isPaidExpert ? "primary" : "turquoise"}
            isPaidExpert={agent.isPaidExpert}
          />
        ))}
      </div>

      {/* Explanation text */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        Agents are sorted by office proximity to {neighborhoodName}. 
        All agents have 4.8+ ratings and 20+ verified reviews.
      </p>
    </div>
  );
}
