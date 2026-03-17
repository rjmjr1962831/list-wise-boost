-- GEO SERP tracking: stores weekly Serper.dev scan results for organic position tracking
CREATE TABLE IF NOT EXISTS geo_serp_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid REFERENCES cities(id),
  city_name text NOT NULL,
  state_slug text NOT NULL,
  query text NOT NULL,
  scan_date date NOT NULL DEFAULT CURRENT_DATE,
  top10lists_position int,          -- null = not found in results
  top10lists_url text,              -- which of our URLs appeared
  cited_as_source boolean DEFAULT false, -- true if we appear in any snippet citation
  total_results int,
  top_competitors jsonb,            -- [{position, url, title}] top 5
  created_at timestamptz DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX idx_geo_serp_scan_date ON geo_serp_results(scan_date DESC);
CREATE INDEX idx_geo_serp_city ON geo_serp_results(city_id, scan_date DESC);
CREATE INDEX idx_geo_serp_state ON geo_serp_results(state_slug, scan_date DESC);

-- Unique constraint: one result per city per scan date
CREATE UNIQUE INDEX idx_geo_serp_unique ON geo_serp_results(city_id, scan_date);

-- Summary view for dashboard
CREATE OR REPLACE VIEW geo_serp_summary AS
SELECT
  scan_date,
  state_slug,
  COUNT(*) AS cities_scanned,
  COUNT(top10lists_position) AS cities_appearing,
  ROUND(100.0 * COUNT(top10lists_position) / NULLIF(COUNT(*), 0), 1) AS appearance_rate_pct,
  ROUND(AVG(top10lists_position) FILTER (WHERE top10lists_position IS NOT NULL), 1) AS avg_position,
  MIN(top10lists_position) FILTER (WHERE top10lists_position IS NOT NULL) AS best_position,
  COUNT(*) FILTER (WHERE cited_as_source = true) AS citation_count
FROM geo_serp_results
GROUP BY scan_date, state_slug
ORDER BY scan_date DESC, state_slug;
