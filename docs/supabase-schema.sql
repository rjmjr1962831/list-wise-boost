-- ============================================
-- TOP10LISTS.US SUPABASE DATABASE SCHEMA
-- Generated: 2026-01-02
-- Purpose: Reference for building Zillow scraper
-- ============================================

-- ============================================
-- CORE TABLES
-- ============================================

-- STATE_LICENSES: Raw license data from state DRE (source of truth)
-- This is where scraped agents are initially stored before prequalification
CREATE TABLE state_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL,  -- e.g., 'AZ', 'CA', 'TX'
  city TEXT,
  license_type TEXT,    -- 'Salesperson', 'Broker', etc.
  brokerage_name TEXT,
  
  -- Contact info (scraped)
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Zillow prequalification data (from Exa search)
  zillow_url TEXT,
  zillow_rating NUMERIC,        -- Must be >= 4.8 to qualify
  zillow_reviews INTEGER,       -- Must be >= 20 to qualify
  zillow_reviews_json JSONB,
  zillow_status TEXT,           -- 'qualified', 'not_qualified', 'not_found', 'error'
  zillow_error TEXT,
  zillow_scraped_at TIMESTAMPTZ,
  
  -- Additional scraped data
  bio TEXT,
  specialties TEXT,
  service_areas TEXT,
  years_experience INTEGER,
  total_sales INTEGER,
  sales_last_12_months INTEGER,
  avg_price NUMERIC,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ARIZONA_LICENSES: Arizona-specific license data (221K records)
CREATE TABLE arizona_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  original_date DATE,           -- License issue date (for years_experience calculation)
  license_type TEXT,
  employer_legal_name TEXT,     -- Brokerage
  employer_phone TEXT,
  mailing_address1 TEXT,
  mailing_address2 TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_zip TEXT,
  mailing_county TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PROFESSIONALS: Qualified agents who passed prequalification AND enrichment
-- Only agents with 4.8+ rating AND 20+ reviews go here
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Required foreign keys
  city_id UUID NOT NULL REFERENCES cities(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  
  -- Basic info
  name TEXT NOT NULL,
  title TEXT,
  type TEXT NOT NULL,           -- 'real-estate-agent'
  rank INTEGER NOT NULL,        -- Position in city listing (1-10)
  active BOOLEAN DEFAULT true,
  
  -- Contact info
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  zip_code TEXT,
  
  -- Profile
  image_url TEXT,
  og_image_url TEXT,
  headline TEXT,
  description TEXT,
  synthesized_bio TEXT,         -- AI-generated bio from profile synthesis
  get_to_know_me TEXT,
  
  -- Credentials
  license_number TEXT,
  license_type TEXT,
  license_status TEXT DEFAULT 'Active',
  license_issued_at TIMESTAMPTZ,
  license_expires_at TIMESTAMPTZ,
  license_verified_at TIMESTAMPTZ,
  years_experience INTEGER,
  
  -- Business
  company TEXT,
  business_name TEXT,
  
  -- Reviews & Ratings (from Zillow/Google)
  review_stars_rating NUMERIC,  -- Average rating (e.g., 4.9)
  num_total_reviews INTEGER,    -- Total review count
  reviews_data JSONB,           -- { zillow_reviews: [], external_reviews: [] }
  reviews_text TEXT,
  review_link TEXT,
  has_recent_review BOOLEAN DEFAULT false,
  most_recent_review_date TIMESTAMPTZ,
  platform_reviews JSONB,       -- [{ platform: 'google', rating: 4.9, count: 150 }]
  
  -- Sales Stats
  total_sales INTEGER,
  current_listings INTEGER,
  agent_sales_stats JSONB,
  past_sales JSONB,
  
  -- Zillow Data
  zuid TEXT,                    -- Zillow user ID
  encoded_zuid TEXT,
  screen_name TEXT,
  zillow_profile_url TEXT,
  zillow_data_fetched_at TIMESTAMPTZ,
  zillow_search_city TEXT,
  zillow_search_page INTEGER,
  zillow_search_position INTEGER,
  zillow_search_total INTEGER,
  zillow_rank_captured_at TIMESTAMPTZ,
  
  -- Profile Types & Badges
  profile_types JSONB,
  profile_type_ids JSONB,
  badges TEXT[],
  is_top_agent BOOLEAN DEFAULT false,
  is_premier_agent BOOLEAN DEFAULT false,
  is_brand_builder BOOLEAN DEFAULT false,
  in_canada BOOLEAN DEFAULT false,
  
  -- Specialties & Services
  specialty TEXT[],
  certifications JSONB,
  certifications_verified JSONB,
  awards_verified JSONB,
  languages JSONB,
  service_areas JSONB,
  
  -- Social
  social_facebook TEXT,
  social_instagram TEXT,
  social_linkedin TEXT,
  social_twitter TEXT,
  social_tiktok TEXT,
  
  -- Press & Achievements
  press_mentions JSONB DEFAULT '[]',
  notable_achievements JSONB DEFAULT '[]',
  publications JSONB DEFAULT '[]',
  community_roles JSONB DEFAULT '[]',
  selection_rationale TEXT,     -- AI-generated explanation of why agent was selected
  selection_rationale_generated_at TIMESTAMPTZ,
  
  -- Video
  sidebar_video_url TEXT,
  
  -- Profile Links
  profile_link TEXT,            -- https://top10lists.us/p/{short_code}
  short_code TEXT,              -- 6-char unique code
  
  -- Claim Status
  claim_status TEXT DEFAULT 'unclaimed',  -- 'unclaimed', 'pending', 'claimed'
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  claim_notes TEXT,
  
  -- Verification
  verification_token TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  verification_started_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  
  -- Funnel Status (for agent onboarding)
  funnel_status TEXT DEFAULT 'welcome',  -- 'welcome', 'verification', 'approved', 'completed'
  funnel_started_at TIMESTAMPTZ,
  funnel_completed_at TIMESTAMPTZ,
  checkout_started_at TIMESTAMPTZ,
  
  -- Subscription
  subscription_status TEXT DEFAULT 'none',
  cities_subscribed TEXT[],
  monthly_revenue_cents INTEGER DEFAULT 0,
  last_payment_at TIMESTAMPTZ,
  last_payment_status TEXT,
  promo_code_used TEXT,
  
  -- Pipedrive Sync
  skip_pipedrive_sync BOOLEAN DEFAULT false,
  
  -- Profile Synthesis
  profile_last_synthesized_at TIMESTAMPTZ,
  card_created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Raw Data
  raw_scraper_data JSONB,
  professional_data JSONB,
  professional_information JSONB,
  agent_licenses JSONB,
  phone_numbers JSONB,
  ratings JSONB,
  business_address JSONB,
  team_display_information JSONB,
  data_sources_log JSONB DEFAULT '[]',
  
  -- Pronouns
  cpd_user_pronouns TEXT,
  profile_image_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CITIES: Active cities with agent listings
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- e.g., 'Phoenix'
  state TEXT NOT NULL,          -- e.g., 'Arizona'
  state_slug TEXT NOT NULL,     -- e.g., 'arizona'
  slug TEXT NOT NULL,           -- e.g., 'phoenix'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CATEGORIES: Professional categories (currently just real estate agents)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- 'Real Estate Agent'
  plural_name TEXT NOT NULL,    -- 'Real Estate Agents'
  slug TEXT NOT NULL,           -- 'top10realestateagents'
  icon TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PIPELINE & QUEUE TABLES
-- ============================================

-- PIPELINE_STATE: Tracks state of the Firecrawl enrichment pipeline
CREATE TABLE pipeline_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name TEXT NOT NULL,  -- e.g., 'firecrawl-enrichment'
  state TEXT NOT NULL,          -- e.g., 'California'
  state_abbr TEXT NOT NULL,     -- e.g., 'CA'
  
  -- Progress
  current_index INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 50,
  concurrency INTEGER DEFAULT 5,  -- Set to 75 for Firecrawl
  
  -- Status
  is_running BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  
  -- Stats
  total_processed INTEGER DEFAULT 0,
  total_qualified INTEGER DEFAULT 0,
  total_not_qualified INTEGER DEFAULT 0,
  total_duplicates INTEGER DEFAULT 0,
  total_no_results INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PIPEDRIVE_SYNC_QUEUE: Queue for syncing professionals to Pipedrive CRM
CREATE TABLE pipedrive_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id),
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PIPEDRIVE_SYNC_STATE: Tracks last sync state for each professional
CREATE TABLE pipedrive_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL UNIQUE REFERENCES professionals(id),
  pipedrive_person_id INTEGER,
  last_synced_at TIMESTAMPTZ,
  last_synced_data JSONB,
  last_sync_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRICING & SUBSCRIPTIONS
-- ============================================

-- ARIZONA_CITY_PRICING: Pricing tiers for Arizona cities
CREATE TABLE arizona_city_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  state TEXT DEFAULT 'Arizona',
  state_abbr TEXT DEFAULT 'AZ',
  tier_name TEXT NOT NULL,      -- 'Premium', 'Standard', 'Emerging'
  value_tier INTEGER NOT NULL,  -- 1=Premium, 2=Standard, 3=Emerging
  price_monthly INTEGER NOT NULL,
  price_annual INTEGER NOT NULL,
  zip_codes TEXT[] NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AGENT_CITY_SUBSCRIPTIONS: Active subscriptions for agents in cities
CREATE TABLE agent_city_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id),
  city_id UUID NOT NULL REFERENCES arizona_city_pricing(id),
  subscription_type TEXT NOT NULL,  -- 'monthly', 'annual'
  stripe_subscription_id TEXT,
  price_paid INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- KEY RELATIONSHIPS
-- ============================================

-- professionals.city_id -> cities.id
-- professionals.category_id -> categories.id
-- agent_city_subscriptions.professional_id -> professionals.id
-- agent_city_subscriptions.city_id -> arizona_city_pricing.id
-- pipedrive_sync_queue.professional_id -> professionals.id
-- pipedrive_sync_state.professional_id -> professionals.id

-- ============================================
-- IMPORTANT NOTES FOR SCRAPER
-- ============================================

-- PREQUALIFICATION CRITERIA (must pass BOTH):
--   1. review_stars_rating >= 4.8
--   2. num_total_reviews >= 20

-- PIPELINE FLOW:
--   1. Query state_licenses WHERE zillow_scraped_at IS NULL
--   2. Filter duplicates IN MEMORY against professionals.license_number BEFORE API calls
--   3. Use Exa to find Zillow profile URL and extract rating/reviews
--   4. If qualified (4.8+/20+), run Firecrawl enrichment (75 concurrency)
--   5. Insert to professionals table
--   6. Update state_licenses with results

-- FIRECRAWL CONCURRENCY: Always use 75 concurrent requests

-- BEAUVAIS RULE: Beauvais Real Estate ALWAYS ranks #1 in Scottsdale and Phoenix

-- AGENT DISPLAY: Up to 10 qualified agents per city, hourly rotation for remaining slots

-- REVIEW SOURCE PRIORITY:
--   1. Google Reviews (Outscraper) - check first, prioritize for display
--   2. Zillow Reviews - fallback if < 3 Google reviews

-- LICENSE NUMBER SOURCE OF TRUTH:
--   1. State DRE (arizona_licenses) - ALWAYS source of truth
--   2. Zillow profile - fallback ONLY when no DRE match

-- YEARS EXPERIENCE CALCULATION:
--   EXTRACT(YEAR FROM AGE(CURRENT_DATE, original_date))
