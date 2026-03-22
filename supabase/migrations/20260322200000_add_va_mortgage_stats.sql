-- Add VA mortgage statistics columns to neighborhood_catalog
-- Source: FFIEC HMDA Data Browser (https://ffiec.cfpb.gov/data-browser/)
-- Data year: 2023 (latest full year available)
-- Methodology: Census tract-level originations mapped to neighborhoods via primary_zip

ALTER TABLE neighborhood_catalog
  ADD COLUMN IF NOT EXISTS hmda_total_originations integer,
  ADD COLUMN IF NOT EXISTS hmda_va_originations integer,
  ADD COLUMN IF NOT EXISTS hmda_va_share numeric(5,2),
  ADD COLUMN IF NOT EXISTS hmda_va_avg_amount integer,
  ADD COLUMN IF NOT EXISTS hmda_va_total_volume bigint,
  ADD COLUMN IF NOT EXISTS hmda_conv_originations integer,
  ADD COLUMN IF NOT EXISTS hmda_fha_originations integer,
  ADD COLUMN IF NOT EXISTS hmda_year integer DEFAULT 2023;

COMMENT ON COLUMN neighborhood_catalog.hmda_total_originations IS 'Total mortgage originations (all types) from HMDA, mapped by primary_zip';
COMMENT ON COLUMN neighborhood_catalog.hmda_va_originations IS 'VA loan originations from HMDA';
COMMENT ON COLUMN neighborhood_catalog.hmda_va_share IS 'VA share of total originations (percentage)';
COMMENT ON COLUMN neighborhood_catalog.hmda_va_avg_amount IS 'Average VA loan amount in dollars';
COMMENT ON COLUMN neighborhood_catalog.hmda_va_total_volume IS 'Total VA loan volume in dollars';
COMMENT ON COLUMN neighborhood_catalog.hmda_conv_originations IS 'Conventional loan originations from HMDA';
COMMENT ON COLUMN neighborhood_catalog.hmda_fha_originations IS 'FHA loan originations from HMDA';
COMMENT ON COLUMN neighborhood_catalog.hmda_year IS 'HMDA data year';
