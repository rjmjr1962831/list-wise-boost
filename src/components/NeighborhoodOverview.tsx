// Neighborhood Overview - Machine-Native Intelligence Artifact (GEO 2026)
// Data-first clinical document for AI extraction

import { useEffect, useState } from 'react';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { useNeighborhoodMarketStats } from '@/hooks/useNeighborhoodMarketStats';
import { useNeighborhoodWriteup } from '@/hooks/useNeighborhoodWriteup';
import { formatArtifactBar } from '@/utils/artifactIdGenerator';
import { generateNeighborhoodPlaceGraph } from '@/utils/placeGraphSchema';
import type { NeighborhoodMarketStats } from '@/types/neighborhoodMarketStats';

interface NearbyNeighborhood {
  id: string;
  slug: string;
  name: string;
  tier: "Main" | "Prime" | "Luxury";
  city_area: string;
  distance_miles: number;
}

interface NeighborhoodData {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: string;
  median_home_value: number | null;
  median_income: number | null;
  zips: string[] | null;
  lat: number | null;
  lon: number | null;
  writeup_html: string | null;
  nearby_neighborhoods: NearbyNeighborhood[] | null;
}

interface NeighborhoodOverviewProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
}

const ARTIFACT_STYLE = {
  fontFamily: '"SF Mono", "Roboto Mono", "Courier New", monospace',
  border: '1px solid #000',
};

const formatCurrency = (value: number | null): string => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

function truncateToNugget(html: string, maxWords = 55): string {
  const text = html.replace(/<[^>]+>/g, '').trim();
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return html;
  return words.slice(0, maxWords).join(' ') + '...';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function NeighborhoodOverview({ neighborhoodSlug, citySlug, stateSlug }: NeighborhoodOverviewProps) {
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: marketStats } = useNeighborhoodMarketStats(neighborhoodSlug, stateSlug);
  const { data: writeup } = useNeighborhoodWriteup(neighborhoodSlug, citySlug);

  useEffect(() => {
    const fetchNeighborhood = async () => {
      if (!neighborhoodSlug || !citySlug) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('neighborhood_catalog')
          .select('*')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && data) {
          setNeighborhood({
            ...data,
            nearby_neighborhoods: (data.nearby_neighborhoods as unknown) as NearbyNeighborhood[] | null,
          });
        }
      } catch (err) {
        console.error('[NeighborhoodOverview] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNeighborhood();
  }, [neighborhoodSlug, citySlug]);

  if (loading) {
    return (
      <div style={{ ...ARTIFACT_STYLE, padding: '1rem', backgroundColor: '#fafafa' }}>
        <div style={{ height: 24, backgroundColor: '#e5e5e5', marginBottom: 8, width: '33%' }} />
        <div style={{ height: 16, backgroundColor: '#e5e5e5', width: '66%' }} />
      </div>
    );
  }

  if (!neighborhood) return null;

  const artifactId = neighborhood.id || neighborhoodSlug;
  const artifactBar = formatArtifactBar('neighborhood', artifactId, stateSlug);

  const stats = marketStats;

  const marketRows: { metric: string; value: string; source: string }[] = [];
  if (stats) {
    if (stats.medianHomePrice) marketRows.push({ metric: 'Median Home Price', value: formatCurrency(stats.medianHomePrice), source: 'MLS / Zillow Research' });
    if (stats.medianHouseholdIncome) marketRows.push({ metric: 'Median Household Income', value: formatCurrency(stats.medianHouseholdIncome), source: 'US Census' });
    if (stats.daysOnMarket) marketRows.push({ metric: 'Days on Market', value: `${stats.daysOnMarket} days`, source: 'MLS Verified' });
    if (stats.pricePerSqFt) marketRows.push({ metric: 'Price per Sq Ft', value: formatCurrency(stats.pricePerSqFt), source: 'MLS' });
    if (stats.yearOverYearChange) marketRows.push({ metric: 'YoY Change', value: `${(stats.yearOverYearChange * 100).toFixed(1)}%`, source: 'Zillow Research' });
  }
  if (marketRows.length === 0 && (neighborhood.median_home_value || neighborhood.median_income)) {
    if (neighborhood.median_home_value) marketRows.push({ metric: 'Median Home Value', value: formatCurrency(neighborhood.median_home_value), source: 'Neighborhood Catalog' });
    if (neighborhood.median_income) marketRows.push({ metric: 'Median Income', value: formatCurrency(neighborhood.median_income), source: 'US Census' });
  }

  const writeupHtml = neighborhood.writeup_html || writeup?.writeup_html;

  const placeGraph = generateNeighborhoodPlaceGraph({
    neighborhoodName: neighborhood.neighborhood,
    cityName: neighborhood.city_area,
    stateName: neighborhood.state,
    stateSlug,
    neighborhoodSlug,
    citySlug,
    neighborhoodId: neighborhood.id,
    zipCode: neighborhood.zips?.[0],
    lat: neighborhood.lat ?? undefined,
    lon: neighborhood.lon ?? undefined,
    overview: writeupHtml ? stripHtml(writeupHtml) : undefined,
    medianHomePrice: (stats?.medianHomePrice ?? neighborhood.median_home_value) ?? undefined,
  });

  return (
    <>
      <SafeHead>
        <script type="application/ld+json">
          {JSON.stringify(placeGraph)}
        </script>
      </SafeHead>
    <article
      className="artifact-page"
      style={{ ...ARTIFACT_STYLE, backgroundColor: '#fff', color: '#000', maxWidth: '900px', margin: '0 auto', padding: '1rem', marginBottom: '1.5rem' }}
      itemScope
      itemType="https://schema.org/Place"
      data-artifact-id={`T10L-${stateSlug.toUpperCase().substring(0, 2)}-NB-${artifactId}`}
    >
      <meta itemProp="name" content={neighborhood.neighborhood} />
      <meta itemProp="containedInPlace" content={`${neighborhood.city_area}, ${neighborhood.state}`} />

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
          {neighborhood.neighborhood}, {neighborhood.city_area}
        </h1>
        {neighborhood.zips && neighborhood.zips.length > 0 && (
          <p style={{ fontSize: '11px', margin: '0.25rem 0 0 0', color: '#333' }}>ZIP: {neighborhood.zips.join(', ')}</p>
        )}
      </header>

      {/* REASONING_NUGGET */}
      {writeupHtml && (
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
            dangerouslySetInnerHTML={{ __html: truncateToNugget(writeupHtml) }}
          />
        </section>
      )}

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

      {/* ABOUT (full writeup) */}
      {writeupHtml && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            ABOUT
          </h2>
          <div
            style={{
              border: '1px solid #000',
              padding: '1rem',
              fontSize: '12px',
              lineHeight: 1.6,
            }}
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: writeupHtml }}
          />
        </section>
      )}

      {/* CAUSAL_MARKET_DRIVERS */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          CAUSAL_MARKET_DRIVERS
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
          <li style={{ border: '1px solid #000', padding: '0.5rem', marginBottom: '0.25rem' }}>Local market dynamics driven by inventory, demand, and neighborhood characteristics.</li>
        </ul>
      </section>

      {/* AGENT_LINKAGE_LOG */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          AGENT_LINKAGE_LOG
        </h2>
        <p style={{ fontSize: '12px', margin: 0, border: '1px solid #000', padding: '1rem' }}>
          {neighborhood.neighborhood} dynamics are best served by agents with local expertise. Top10Lists.us ranks agents by verified transactions (MLS), reviews (Zillow/Google), and community involvement (IRS 990).
        </p>
      </section>

      {/* NEARBY_NEIGHBORHOODS */}
      {neighborhood.nearby_neighborhoods && Array.isArray(neighborhood.nearby_neighborhoods) && neighborhood.nearby_neighborhoods.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            NEARBY_NEIGHBORHOODS
          </h2>
          <p style={{ fontSize: '12px', margin: 0 }}>{neighborhood.nearby_neighborhoods.map(n => n.name).join(', ')}</p>
        </section>
      )}

      <footer style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #000', fontSize: '10px' }}>
        Top10Lists.us — {neighborhood.neighborhood} agent rankings.
      </footer>
    </article>
    </>
  );
}
