-- =====================================================
-- NEIGHBORHOOD-BASED PRICING ENGINE SCHEMA
-- Replaces city-based pricing with neighborhood tiers
-- =====================================================

-- 1. Create neighborhood_catalog table (universal, no prices stored)
CREATE TABLE public.neighborhood_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  city_area TEXT NOT NULL,
  city_area_slug TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  neighborhood_slug TEXT NOT NULL,
  zips TEXT[] DEFAULT '{}',
  lat DECIMAL(10, 7),
  lon DECIMAL(10, 7),
  median_income INTEGER,
  median_home_value INTEGER,
  tier TEXT NOT NULL CHECK (tier IN ('Main', 'Prime', 'Luxury')),
  income_pct DECIMAL(5, 2),
  value_pct DECIMAL(5, 2),
  score DECIMAL(5, 2),
  is_verified BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for neighborhood_catalog
CREATE INDEX idx_neighborhood_catalog_state ON public.neighborhood_catalog(state);
CREATE INDEX idx_neighborhood_catalog_city_area_slug ON public.neighborhood_catalog(city_area_slug);
CREATE INDEX idx_neighborhood_catalog_zips ON public.neighborhood_catalog USING GIN(zips);
CREATE INDEX idx_neighborhood_catalog_tier ON public.neighborhood_catalog(tier);
CREATE UNIQUE INDEX idx_neighborhood_catalog_unique ON public.neighborhood_catalog(state, city_area_slug, neighborhood_slug);

-- 2. Create pricing_configs table (multi-scope configuration)
CREATE TABLE public.pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'state', 'city', 'zip')),
  scope_key TEXT,
  tier_prices JSONB NOT NULL DEFAULT '{"Main": 39, "Prime": 69, "Luxury": 99}',
  market_multipliers JSONB DEFAULT '[]',
  neighborhood_overrides JSONB DEFAULT '[]',
  time_rules JSONB DEFAULT '[]',
  rounding JSONB DEFAULT '{"method": "nearest", "increment": 1}',
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active configs
CREATE INDEX idx_pricing_configs_active ON public.pricing_configs(is_active, scope_type);

-- 3. Create agent_neighborhood_subscriptions table
CREATE TABLE public.agent_neighborhood_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhood_catalog(id) ON DELETE CASCADE,
  tier_at_purchase TEXT NOT NULL CHECK (tier_at_purchase IN ('Main', 'Prime', 'Luxury')),
  price_paid INTEGER NOT NULL DEFAULT 0,
  config_version_used TEXT,
  stripe_subscription_id TEXT,
  subscription_type TEXT NOT NULL DEFAULT 'monthly' CHECK (subscription_type IN ('monthly', 'annual', 'free')),
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for agent_neighborhood_subscriptions
CREATE INDEX idx_agent_neighborhood_subs_professional ON public.agent_neighborhood_subscriptions(professional_id);
CREATE INDEX idx_agent_neighborhood_subs_neighborhood ON public.agent_neighborhood_subscriptions(neighborhood_id);
CREATE INDEX idx_agent_neighborhood_subs_active ON public.agent_neighborhood_subscriptions(is_active);
CREATE UNIQUE INDEX idx_agent_neighborhood_subs_unique ON public.agent_neighborhood_subscriptions(professional_id, neighborhood_id) WHERE is_active = true;

-- 4. Create unrecognized_neighborhoods table
CREATE TABLE public.unrecognized_neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_string TEXT NOT NULL,
  state TEXT,
  city_area TEXT,
  requested_by UUID REFERENCES public.professionals(id),
  request_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'unverified' CHECK (status IN ('unverified', 'pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_unrecognized_neighborhoods_status ON public.unrecognized_neighborhoods(status);

-- 5. Updated_at triggers
CREATE TRIGGER update_neighborhood_catalog_updated_at
  BEFORE UPDATE ON public.neighborhood_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_configs_updated_at
  BEFORE UPDATE ON public.pricing_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_neighborhood_subs_updated_at
  BEFORE UPDATE ON public.agent_neighborhood_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_unrecognized_neighborhoods_updated_at
  BEFORE UPDATE ON public.unrecognized_neighborhoods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies
ALTER TABLE public.neighborhood_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_neighborhood_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unrecognized_neighborhoods ENABLE ROW LEVEL SECURITY;

-- neighborhood_catalog: Public read
CREATE POLICY "Anyone can view neighborhood catalog"
  ON public.neighborhood_catalog FOR SELECT USING (true);

-- pricing_configs: Public read
CREATE POLICY "Anyone can view pricing configs"
  ON public.pricing_configs FOR SELECT USING (true);

-- agent_neighborhood_subscriptions: Public read for display, service role manages
CREATE POLICY "Anyone can view neighborhood subscriptions"
  ON public.agent_neighborhood_subscriptions FOR SELECT USING (true);

CREATE POLICY "Service role manages neighborhood subscriptions"
  ON public.agent_neighborhood_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- unrecognized_neighborhoods: Service role only
CREATE POLICY "Service role manages unrecognized neighborhoods"
  ON public.unrecognized_neighborhoods FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Insert initial global pricing config
INSERT INTO public.pricing_configs (
  config_version,
  scope_type,
  scope_key,
  tier_prices,
  market_multipliers,
  neighborhood_overrides,
  time_rules,
  rounding,
  is_active
) VALUES (
  'v1.0',
  'global',
  NULL,
  '{"Main": 39, "Prime": 69, "Luxury": 99}',
  '[]',
  '[]',
  '[]',
  '{"method": "nearest", "increment": 1}',
  true
);

-- 8. Deprecate old tables (rename, preserve data)
ALTER TABLE IF EXISTS public.arizona_city_pricing RENAME TO arizona_city_pricing_deprecated;
ALTER TABLE IF EXISTS public.agent_city_subscriptions RENAME TO agent_city_subscriptions_deprecated;