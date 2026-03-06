import { useMemo } from 'react';
import { SafeHead } from "@/components/SafeHead";
import { useAreaAgents } from '@/hooks/useAreaAgents';
import { CleanRoomAgentArticle } from './CleanRoomAgentArticle';
import { VerificationDisclaimer } from '@/components/VerificationDisclaimer';
import { ARIZONA_TOTAL_LICENSED_AGENTS } from '@/data/arizonaCityPricing';

interface NeighborhoodExpertPageProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
  primaryZip?: string;
  /** When neighborhoodSlug === citySlug (city-wide), pass city-level agents to show full list */
  agentsOverride?: Array<{ id: string; name: string; [key: string]: unknown }>;
}

/**
 * NeighborhoodExpertPage - Clean-room layout (Scottsdale style).
 * Selected Real Estate Professionals section with Table of Contents and article cards.
 */
export function NeighborhoodExpertPage({
  neighborhoodSlug,
  citySlug,
  stateSlug,
  neighborhoodName,
  agentsOverride,
}: NeighborhoodExpertPageProps) {
  const { agents: areaAgents, loading } = useAreaAgents({
    neighborhoodSlug,
    citySlug,
    stateSlug,
    radiusMiles: 5,
  });
  const agents = agentsOverride ?? areaAgents;

  // Order by tier (underwritten, audited, certified, listed) then by transactions (hook already does this; ensure consistency)
  const tierOrder: Record<string, number> = {
    underwritten: 4,
    audited: 3,
    certified: 2,
    listed: 1,
  };
  const sortedAgents = useMemo(() => {
    return [...areaAgents].sort((a, b) => {
      const aTier = tierOrder[(a as any).current_tier?.toLowerCase()] ?? 1;
      const bTier = tierOrder[(b as any).current_tier?.toLowerCase()] ?? 1;
      if (bTier !== aTier) return bTier - aTier;
      const txA = (a as any).neighborhoodTransactions ?? 0;
      const txB = (b as any).neighborhoodTransactions ?? 0;
      return txB - txA;
    });
  }, [agents]);

  const agentItemListSchema = useMemo(() => {
    if (sortedAgents.length === 0) return null;
    const stateAbbrev = stateSlug.toUpperCase().substring(0, 2);
    const cityName = citySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const pageUrl = `https://www.top10lists.us/${stateSlug}/${citySlug}/${neighborhoodSlug}/top10realestateagents`;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Top Real Estate Agents in ${neighborhoodName}, ${cityName}, ${stateAbbrev}`,
      "description": `Ranked list of top-rated real estate agents serving ${neighborhoodName}, ${cityName}. Verified by Top10Lists.us.`,
      "url": pageUrl,
      "numberOfItems": sortedAgents.length,
      "dateModified": new Date().toISOString().split('T')[0],
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "itemListElement": sortedAgents.map((agent, index) => {
        const raw = agent as any;
        const safeId = `agent-${String(raw.license_number || raw.id).replace(/[^a-zA-Z0-9-]/g, '-')}`;
        return {
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "RealEstateAgent",
            "name": agent.name,
            "url": `${pageUrl}#${safeId}`,
            "telephone": agent.phone || undefined,
            "description": raw.selection_rationale || `Ranked #${index + 1} real estate agent in ${neighborhoodName}, ${cityName}. Verified by Top10Lists.us.`,
            ...(agent.company && { "parentOrganization": { "@type": "Organization", "name": agent.company } }),
            ...(agent.rating > 0 && {
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": agent.rating.toString(),
                "reviewCount": agent.reviews?.toString() || "0",
                "bestRating": "5",
              },
            }),
            "areaServed": { "@type": "Place", "name": `${neighborhoodName}, ${cityName}, ${stateAbbrev}` },
          },
        };
      }),
    };
  }, [sortedAgents, neighborhoodName, stateSlug, citySlug, neighborhoodSlug]);

  if (!agentsOverride && loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-3xl mx-auto font-serif">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-24 bg-muted rounded" />
        <div className="h-48 bg-muted rounded" />
      </div>
    );
  }

  const totalLicensed = stateSlug === 'arizona' ? ARIZONA_TOTAL_LICENSED_AGENTS : 100000;

  return (
    <>
      {agentItemListSchema && (
        <SafeHead>
          <script type="application/ld+json">{JSON.stringify(agentItemListSchema)}</script>
        </SafeHead>
      )}

      <section id="agent-directory" className="mt-8 max-w-3xl mx-auto font-serif text-[#1a1a1a]">
        <h2 className="text-[1.4rem] font-semibold mt-8 mb-4 pb-2 border-b border-gray-300">
          Selected Real Estate Professionals ({sortedAgents.length})
        </h2>
        <p className="mb-4">
          {stateSlug === 'arizona' ? 'Arizona' : 'The state'} has over {totalLicensed.toLocaleString()} licensed real
          estate agents. Top10Lists.us identified {sortedAgents.length} serving {neighborhoodName} who meet merit
          criteria.
        </p>

        <VerificationDisclaimer />

        {sortedAgents.length > 0 && (
          <details className="mb-6">
            <summary className="cursor-pointer font-semibold text-[0.95rem]">
              Table of Contents: All {sortedAgents.length} Agents
            </summary>
            <ol className="list-decimal pl-6 mt-2 space-y-1 text-[0.9rem]">
              {sortedAgents.map((agent, index) => {
                const raw = agent as any;
                const tier = (raw.current_tier || 'listed').toLowerCase();
                const tierLabel =
                  tier === 'underwritten'
                    ? 'Underwritten'
                    : tier === 'certified'
                      ? 'Certified'
                      : tier === 'accredited' || tier === 'audited'
                        ? 'Audited'
                        : 'Listed';
                const safeId = `agent-${String(raw.license_number || raw.id).replace(/[^a-zA-Z0-9-]/g, '-')}`;
                const rating = raw.review_stars_rating || agent.rating || 0;
                const reviews = raw.num_total_reviews || agent.reviews || 0;
                const reviewStr =
                  reviews > 0
                    ? `${Math.max(0, Math.floor((reviews - 10) / 10) * 10)}+`
                    : '';
                const parts: string[] = [];
                if (rating > 0) parts.push(`${rating} stars`);
                if (reviewStr) parts.push(`${reviewStr} reviews`);
                parts.push(tierLabel.toLowerCase());
                return (
                  <li key={agent.id}>
                    <a href={`#${safeId}`} className="text-[#1a56db] hover:underline">
                      {agent.name}
                    </a>{' '}
                    ({parts.join(', ')})
                  </li>
                );
              })}
            </ol>
          </details>
        )}

        <div className="space-y-0">
          {sortedAgents.map((agent, index) => (
            <CleanRoomAgentArticle
              key={agent.id}
              professional={agent}
              stateSlug={stateSlug}
              citySlug={citySlug}
              index={index}
            />
          ))}
        </div>

        {sortedAgents.length === 0 && (
          <p className="text-muted-foreground py-4">
            No qualified agents with verified activity in {neighborhoodName} found yet.
          </p>
        )}
      </section>
    </>
  );
}
