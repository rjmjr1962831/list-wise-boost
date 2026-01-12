-- Zillow Data Enrichment Schema Migration
-- Creates tables to store enriched agent data from Memo23 Zillow scraping
-- Uses UUID for foreign keys to match professionals.id type

-- ============================================================================
-- PHASE 1: Add New Columns to professionals Table
-- ============================================================================

-- Zillow membership and flags
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_member_since DATE;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_flag INTEGER;

-- Contact information
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS cell_phone TEXT;

-- Extracted business address fields for querying
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS business_city TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS business_state TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS business_zip TEXT;

-- Sales statistics (extracted from agent_sales_stats JSONB for easier querying)
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS sales_count_all_time INTEGER;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS sales_count_last_year INTEGER;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS price_range_3yr_min INTEGER;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS price_range_3yr_max INTEGER;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS average_value_3yr INTEGER;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS stats_include_team BOOLEAN DEFAULT false;

-- Team structure
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN DEFAULT false;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS team_lead_zuid TEXT;

-- Current listings counts
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS active_for_sale_count INTEGER DEFAULT 0;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS active_for_rent_count INTEGER DEFAULT 0;

-- Data source and freshness tracking (default to memo23)
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_data_source TEXT DEFAULT 'memo23';
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_last_scraped_at TIMESTAMPTZ;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_scrape_status TEXT DEFAULT 'pending';
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS zillow_scrape_error TEXT;

-- Create index for finding stale data needing refresh (no partial index with CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_professionals_scrape_age 
ON professionals(zillow_last_scraped_at, zillow_scrape_status);

-- ============================================================================
-- PHASE 2: Create New Related Tables
-- ============================================================================

-- Table: agent_licenses
CREATE TABLE IF NOT EXISTS agent_licenses (
  id BIGSERIAL PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  state TEXT NOT NULL,
  license_type TEXT,
  status TEXT,
  original_status TEXT,
  expiration_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(professional_id, license_number, state)
);

CREATE INDEX IF NOT EXISTS idx_agent_licenses_professional ON agent_licenses(professional_id);
CREATE INDEX IF NOT EXISTS idx_agent_licenses_number ON agent_licenses(license_number);
CREATE INDEX IF NOT EXISTS idx_agent_licenses_state ON agent_licenses(state);

-- Backfill from existing professionals data
INSERT INTO agent_licenses (professional_id, license_number, state, status)
SELECT 
  id,
  license_number,
  state_slug,
  license_status
FROM professionals
WHERE license_number IS NOT NULL
  AND state_slug IS NOT NULL
ON CONFLICT (professional_id, license_number, state) DO NOTHING;

-- Table: agent_transactions
CREATE TABLE IF NOT EXISTS agent_transactions (
  id BIGSERIAL PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  zillow_zpid BIGINT NOT NULL,
  represented_list JSONB NOT NULL DEFAULT '["buyer"]',
  sold_date DATE NOT NULL,
  price INTEGER NOT NULL,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  living_area_sqft INTEGER,
  image_url TEXT,
  medium_image_url TEXT,
  home_details_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(professional_id, zillow_zpid, sold_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_transactions_professional ON agent_transactions(professional_id);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_sold_date ON agent_transactions(sold_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_zip ON agent_transactions(zip_code);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_city_state ON agent_transactions(city, state);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_price ON agent_transactions(price);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_zip_date ON agent_transactions(zip_code, sold_date DESC);

-- Table: agent_listings
CREATE TABLE IF NOT EXISTS agent_listings (
  id BIGSERIAL PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  zillow_zpid BIGINT NOT NULL UNIQUE,
  listing_type TEXT NOT NULL,
  home_type TEXT,
  status TEXT,
  marketing_status TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  price INTEGER NOT NULL,
  price_currency TEXT DEFAULT 'usd',
  has_open_house BOOLEAN DEFAULT false,
  open_houses TEXT,
  has_vr_model BOOLEAN DEFAULT false,
  primary_photo_url TEXT,
  listing_url TEXT,
  brokerage_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_listings_professional ON agent_listings(professional_id);
CREATE INDEX IF NOT EXISTS idx_agent_listings_type ON agent_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_agent_listings_status ON agent_listings(status);
CREATE INDEX IF NOT EXISTS idx_agent_listings_zip ON agent_listings(zip_code);
CREATE INDEX IF NOT EXISTS idx_agent_listings_scraped ON agent_listings(scraped_at DESC);

-- Table: agent_reviews
CREATE TABLE IF NOT EXISTS agent_reviews (
  id BIGSERIAL PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  zillow_review_id BIGINT NOT NULL UNIQUE,
  rating INTEGER NOT NULL,
  comment TEXT,
  work_description TEXT,
  review_date TIMESTAMPTZ NOT NULL,
  local_knowledge_score INTEGER,
  process_expertise_score INTEGER,
  responsiveness_score INTEGER,
  negotiation_skills_score INTEGER,
  reviewer_screen_name TEXT,
  reviewer_first_name TEXT,
  reviewer_last_name TEXT,
  reviewer_show_name BOOLEAN DEFAULT false,
  rebuttal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validation trigger for rating range (1-5)
CREATE OR REPLACE FUNCTION validate_agent_review_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_agent_review_rating ON agent_reviews;
CREATE TRIGGER trg_validate_agent_review_rating
BEFORE INSERT OR UPDATE ON agent_reviews
FOR EACH ROW EXECUTE FUNCTION validate_agent_review_rating();

CREATE INDEX IF NOT EXISTS idx_agent_reviews_professional ON agent_reviews(professional_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_rating ON agent_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_date ON agent_reviews(review_date DESC);

-- Table: agent_team_members
CREATE TABLE IF NOT EXISTS agent_team_members (
  id BIGSERIAL PRIMARY KEY,
  team_lead_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_screen_name TEXT,
  member_zillow_zuid TEXT,
  member_photo_url TEXT,
  member_review_count INTEGER,
  member_review_average DECIMAL(3, 2),
  member_is_top_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_lead_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_lead ON agent_team_members(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON agent_team_members(member_id);

-- ============================================================================
-- PHASE 3: Create Analytics Views
-- ============================================================================

-- Agent activity by ZIP code in last 12 months
CREATE OR REPLACE VIEW agent_zip_activity_12mo AS
SELECT 
  professional_id,
  zip_code,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN represented_list @> '["buyer"]'::jsonb THEN 1 ELSE 0 END) as buyer_count,
  SUM(CASE WHEN represented_list @> '["seller"]'::jsonb THEN 1 ELSE 0 END) as seller_count,
  AVG(price)::INTEGER as avg_price,
  MIN(sold_date) as first_transaction,
  MAX(sold_date) as last_transaction
FROM agent_transactions
WHERE sold_date >= CURRENT_DATE - INTERVAL '12 months'
  AND zip_code IS NOT NULL
GROUP BY professional_id, zip_code;

-- Team performance summary
CREATE OR REPLACE VIEW team_performance AS
SELECT 
  atm.team_lead_id,
  atm.team_name,
  COUNT(DISTINCT atm.member_id) as team_size,
  SUM(p.num_total_reviews) as total_reviews,
  AVG(p.review_stars_rating)::DECIMAL(3,2) as avg_team_rating,
  SUM(p.sales_count_last_year) as total_sales_last_year
FROM agent_team_members atm
JOIN professionals p ON atm.member_id = p.id
GROUP BY atm.team_lead_id, atm.team_name;

-- ============================================================================
-- PHASE 4: Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE agent_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON agent_licenses FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agent_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agent_listings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agent_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agent_team_members FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON agent_licenses FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON agent_transactions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON agent_listings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON agent_reviews FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON agent_team_members FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- PHASE 5: Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_agent_active_zips(p_professional_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(DISTINCT zip_code ORDER BY zip_code)
  FROM agent_transactions
  WHERE professional_id = p_professional_id
    AND sold_date >= CURRENT_DATE - INTERVAL '12 months'
    AND zip_code IS NOT NULL;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_agent_active_in_zip(p_professional_id UUID, p_zip_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM agent_transactions
    WHERE professional_id = p_professional_id
      AND zip_code = p_zip_code
      AND sold_date >= CURRENT_DATE - INTERVAL '12 months'
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- PHASE 6: Maintenance Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_agent_listing_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE professionals
  SET 
    active_for_sale_count = (
      SELECT COUNT(*) FROM agent_listings 
      WHERE professional_id = COALESCE(NEW.professional_id, OLD.professional_id)
        AND listing_type = 'for_sale'
    ),
    active_for_rent_count = (
      SELECT COUNT(*) FROM agent_listings 
      WHERE professional_id = COALESCE(NEW.professional_id, OLD.professional_id)
        AND listing_type = 'for_rent'
    )
  WHERE id = COALESCE(NEW.professional_id, OLD.professional_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_listing_counts ON agent_listings;
CREATE TRIGGER trg_update_listing_counts
AFTER INSERT OR UPDATE OR DELETE ON agent_listings
FOR EACH ROW
EXECUTE FUNCTION update_agent_listing_counts();

-- Add comments
COMMENT ON TABLE agent_transactions IS 'Stores complete transaction history from Zillow via Memo23 enrichment';
COMMENT ON TABLE agent_licenses IS 'Normalized storage of agent licenses across multiple states';
COMMENT ON TABLE agent_listings IS 'Current active listings (for sale and for rent)';
COMMENT ON TABLE agent_reviews IS 'Individual Zillow reviews with detailed scoring';
COMMENT ON TABLE agent_team_members IS 'Team structure and member relationships';
COMMENT ON VIEW agent_zip_activity_12mo IS 'Shows agent transaction activity by ZIP code in last 12 months';
COMMENT ON FUNCTION get_agent_active_zips IS 'Returns array of ZIP codes where agent had transactions in last 12 months';
COMMENT ON FUNCTION is_agent_active_in_zip IS 'Returns true if agent had transactions in specific ZIP in last 12 months';