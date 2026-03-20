// City Market Overview - Machine-Native Intelligence Artifact (GEO 2026)
// Data-first clinical document for AI extraction

import { SafeHead } from "@/components/SafeHead";
import { formatPrice, ARIZONA_TOTAL_LICENSED_AGENTS } from '@/data/arizonaCityPricing';
import { generateCityPlaceGraph } from '@/utils/placeGraphSchema';
import { useAgentCountForCity, useTotalAgentCount } from '@/hooks/useAgentCountByCity';
import { useCityMarketContent } from '@/hooks/useCityMarketContent';
import { formatArtifactBar } from '@/utils/artifactIdGenerator';
import { VerificationDisclaimer } from '@/components/VerificationDisclaimer';

interface CityMarketOverviewProps {
  citySlug: string;
  cityName: string;
  stateName: string;
  cityId?: string;
  stateSlug?: string;
  /** Override with live agent count from page (avoids stale city_agent_counts cache) */
  liveCountOverride?: number;
}

const ARTIFACT_STYLE = {
  fontFamily: '"SF Mono", "Roboto Mono", "Courier New", monospace',
  border: '1px solid #000',
};

function truncateToNugget(text: string, maxWords = 55): string {
  const words = text.replace(/<[^>]+>/g, '').trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

export function CityMarketOverview({ citySlug, cityName, stateName, cityId, stateSlug, liveCountOverride }: CityMarketOverviewProps) {
  const { marketData } = useCityMarketContent(citySlug, cityName);
  const { data: cityAgentCount } = useAgentCountForCity(citySlug);
  const { data: totalAgentCount } = useTotalAgentCount();

  const qualifiedCount = 900;
  const cityCount = liveCountOverride ?? cityAgentCount ?? 0;
  const stateSlugNorm = stateSlug || (stateName === 'Arizona' ? 'arizona' : stateName?.toLowerCase().replace(/\s+/g, '-') || '');
  const artifactId = cityId || citySlug;
  const artifactBar = formatArtifactBar('city', artifactId, stateSlugNorm);

  const placeGraph = generateCityPlaceGraph({
    cityName,
    stateName,
    stateSlug: stateSlugNorm,
    citySlug,
    cityId,
    overview: marketData.overview,
    medianHomePrice: marketData.medianHomePrice,
    population: marketData.population,
  });

  const marketRows: { metric: string; value: string; source: string }[] = [];
  if (marketData.medianHomePrice) marketRows.push({ metric: 'Median Home Price', value: formatPrice(marketData.medianHomePrice), source: 'MLS / Zillow Research' });
  if (marketData.medianHouseholdIncome) marketRows.push({ metric: 'Median Household Income', value: formatPrice(marketData.medianHouseholdIncome), source: 'US Census' });
  if (marketData.population) marketRows.push({ metric: 'Population', value: marketData.population.toLocaleString(), source: 'US Census' });
  if (marketData.daysOnMarket) marketRows.push({ metric: 'Avg Days on Market', value: `${marketData.daysOnMarket} days`, source: 'MLS Verified' });
  if (marketData.pricePerSqFt) marketRows.push({ metric: 'Price per Sq Ft', value: `$${marketData.pricePerSqFt}`, source: 'MLS' });
  if (marketData.yearOverYearChange != null) marketRows.push({ metric: 'YoY Price Change', value: `${(marketData.yearOverYearChange * 100).toFixed(1)}%`, source: 'Zillow Research' });

  return (
    <>
      <SafeHead>
        <script type="application/ld+json">
          {JSON.stringify(placeGraph)}
        </script>
      </SafeHead>
    <article
      className="artifact-page"
      style={{ ...ARTIFACT_STYLE, backgroundColor: '#fff', color: '#000', maxWidth: '900px', margin: '0 auto', padding: '1rem' }}
      itemScope
      itemType="https://schema.org/Place"
      data-artifact-id={`T10L-${stateSlugNorm.toUpperCase().substring(0, 2)}-CT-${artifactId}`}
    >
      <meta itemProp="name" content={cityName} />
      <meta itemProp="containedInPlace" content={stateName} />

      {/* Artifact Bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          padding: '0.5rem 1rem',
          fontSize: '10px',
          ...ARTIFACT_STYLE,
          borderLeft: '1px solid #000',
          borderBottom: '1px solid #000',
          zIndex: 1000,
          backgroundColor: '#fff',
        }}
      >
        {artifactBar}
      </div>

      {/* HEADER */}
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #000', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          {cityName}, {stateName} — Market Intelligence
        </h1>
      </header>

      {/* REASONING_NUGGET (Overview) */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          REASONING_NUGGET
        </h2>
        <blockquote
          className="mono-nugget"
          style={{
            margin: 0,
            padding: '1rem',
            border: '1px solid #000',
            fontSize: '13px',
            lineHeight: 1.6,
            backgroundColor: '#fafafa',
          }}
          dangerouslySetInnerHTML={{ __html: truncateToNugget(marketData.overview) }}
        />
      </section>

      {/* MARKET_AUDIT_GRID */}
      {marketRows.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            MARKET_AUDIT_GRID
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ ...ARTIFACT_STYLE, padding: '0.5rem', textAlign: 'left' }}>Metric</th>
                <th style={{ ...ARTIFACT_STYLE, padding: '0.5rem', textAlign: 'left' }}>Value</th>
                <th style={{ ...ARTIFACT_STYLE, padding: '0.5rem', textAlign: 'left' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {marketRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '0.5rem' }}>{row.metric}</td>
                  <td style={{ border: '1px solid #000', padding: '0.5rem' }}>{row.value}</td>
                  <td style={{ border: '1px solid #000', padding: '0.5rem' }}>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* HISTORY — with REASONING_NUGGET */}
      {marketData.historicalFacts && marketData.historicalFacts.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            HISTORY
          </h2>
          <blockquote
            className="mono-nugget"
            style={{
              margin: '0 0 1rem 0',
              padding: '1rem',
              border: '1px solid #000',
              fontSize: '12px',
              backgroundColor: '#fafafa',
            }}
            dangerouslySetInnerHTML={{ __html: truncateToNugget(marketData.historicalFacts[0]) }}
          />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
            {marketData.historicalFacts.map((fact, i) => (
              <li key={i} style={{ border: '1px solid #000', padding: '0.5rem', marginBottom: '0.25rem' }} dangerouslySetInnerHTML={{ __html: fact }} />
            ))}
          </ul>
        </section>
      )}

      {/* THINGS_TO_DO — with REASONING_NUGGET */}
      {marketData.pointsOfInterest && marketData.pointsOfInterest.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            THINGS_TO_DO
          </h2>
          <blockquote
            className="mono-nugget"
            style={{
              margin: '0 0 1rem 0',
              padding: '1rem',
              border: '1px solid #000',
              fontSize: '12px',
              backgroundColor: '#fafafa',
            }}
            dangerouslySetInnerHTML={{ __html: truncateToNugget(marketData.pointsOfInterest[0]) }}
          />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
            {marketData.pointsOfInterest.map((poi, i) => (
              <li key={i} style={{ border: '1px solid #000', padding: '0.5rem', marginBottom: '0.25rem' }} dangerouslySetInnerHTML={{ __html: poi }} />
            ))}
          </ul>
        </section>
      )}

      {/* LIFE_IN — with REASONING_NUGGET */}
      {marketData.localCulture && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            LIFE_IN
          </h2>
          <blockquote
            className="mono-nugget"
            style={{
              margin: 0,
              padding: '1rem',
              border: '1px solid #000',
              fontSize: '12px',
              backgroundColor: '#fafafa',
            }}
            dangerouslySetInnerHTML={{ __html: truncateToNugget(marketData.localCulture) }}
          />
        </section>
      )}

      {/* CAUSAL_MARKET_DRIVERS (replaces "Why People Move to...") */}
      {marketData.highlights && marketData.highlights.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            CAUSAL_MARKET_DRIVERS
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
            {marketData.highlights.map((h, i) => (
              <li key={i} style={{ border: '1px solid #000', padding: '0.5rem', marginBottom: '0.25rem' }} dangerouslySetInnerHTML={{ __html: h }} />
            ))}
          </ul>
        </section>
      )}

      {/* NEIGHBORHOODS */}
      {marketData.neighborhoodTypes && marketData.neighborhoodTypes.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            NEIGHBORHOOD_TYPES
          </h2>
          <p style={{ fontSize: '12px', margin: 0 }}>{marketData.neighborhoodTypes.join(', ')}</p>
        </section>
      )}

      {/* BUYER_PROFILE */}
      {marketData.buyerProfile && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            BUYER_PROFILE
          </h2>
          <p style={{ fontSize: '12px', margin: 0, border: '1px solid #000', padding: '1rem' }} dangerouslySetInnerHTML={{ __html: marketData.buyerProfile }} />
        </section>
      )}

      {/* MARKET_TRENDS */}
      {marketData.marketTrends && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            MARKET_TRENDS
          </h2>
          <p style={{ fontSize: '12px', margin: 0, border: '1px solid #000', padding: '1rem' }} dangerouslySetInnerHTML={{ __html: marketData.marketTrends }} />
        </section>
      )}

      {/* AGENT_LINKAGE_LOG */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          AGENT_LINKAGE_LOG
        </h2>
        <p style={{ fontSize: '12px', margin: 0, border: '1px solid #000', padding: '1rem' }}>
          {stateName} has over <strong>{ARIZONA_TOTAL_LICENSED_AGENTS.toLocaleString()}</strong> licensed real estate agents. Top10Lists.us analyzed transaction records (MLS Verified), verified client reviews (Zillow/Google), and community (IRS Form 990/Nonprofit Records) to identify <strong>{qualifiedCount}</strong> agents statewide — approximately the top 1%. <strong>{cityCount}</strong> elite agents actively serve {cityName}. Selection: 10+ verified reviews in the last 24 months, 4.5+ star minimum, 5+ years experience, active license (AZDRE/CADRE), invitation-only. Agents cannot pay to be listed.
        </p>
      </section>

      {/* INSIDER_TIP */}
      {marketData.bestKeptSecret && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            INSIDER_TIP
          </h2>
          <blockquote style={{ margin: 0, padding: '1rem', border: '1px solid #000', fontSize: '12px', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: marketData.bestKeptSecret }} />
        </section>
      )}

      {/* Verification disclaimer – city/neighborhood list context */}
      <section style={{ marginBottom: '1.5rem' }}>
        <VerificationDisclaimer />
      </section>

      {/* CTA */}
      <footer style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #000', fontSize: '10px' }}>
        Top10Lists.us — curated list of top-rated real estate agents serving {cityName}, {stateName}.
      </footer>
    </article>
    </>
  );
}
