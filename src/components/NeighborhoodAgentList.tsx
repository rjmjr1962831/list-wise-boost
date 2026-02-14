import { AgentBadge } from '@/components/AgentBadge';
import { useNeighborhoodAgents } from '@/hooks/useNeighborhoodAgents';
import { Users, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface NeighborhoodAgentListProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
  primaryZip?: string;
  maxAgents?: number;
}

const MAX_PREVIEW_AGENTS = 8;

export function NeighborhoodAgentList({
  neighborhoodSlug,
  citySlug,
  stateSlug,
  neighborhoodName,
  primaryZip,
  maxAgents = MAX_PREVIEW_AGENTS
}: NeighborhoodAgentListProps) {
  const { agents, loading, error, totalCount } = useNeighborhoodAgents({
    neighborhoodSlug,
    citySlug,
    stateSlug
  });

  // Filter out paid experts (they're shown in VerifiedExpertsSection)
  const qualifiedAgents = agents.filter(a => !a.isPaidExpert);
  const displayAgents = qualifiedAgents.slice(0, maxAgents);
  const hasMore = qualifiedAgents.length > maxAgents;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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

  if (displayAgents.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <Users className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">
          No agents with offices near {neighborhoodName} found yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">
            Editorially Selected Agents Near {neighborhoodName}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Agents selected and ordered based on our multi-layer verification process (Performance Data, Community Standing, Human Editorial Review).
        </p>
      </div>

      {/* Agent Grid - semantic ordered list for Google rich snippets */}
      <ol className="grid gap-4 md:grid-cols-2 list-none p-0 m-0">
        {displayAgents.map((agent) => (
          <li key={agent.id} className="list-none">
            <AgentBadge
              professional={agent}
              stateSlug={stateSlug}
              citySlug={citySlug}
              accentColor="turquoise"
              isPaidExpert={false}
            />
          </li>
        ))}
      </ol>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center">
        Sorted by office proximity by default. Filters available on the full list.
      </p>

      {/* CTA to full qualified agents page with 5-segment URL when ZIP available */}
      <div className="flex justify-center pt-2">
        <Button asChild variant="default" size="lg">
          <Link to={`/${stateSlug}/${citySlug}/${neighborhoodSlug}/qualified-real-estate-agents`}>
            Continue to all qualified agents
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
