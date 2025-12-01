CREATE TABLE arizona_city_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  city_slug TEXT NOT NULL UNIQUE,
  state TEXT DEFAULT 'Arizona',
  state_abbr TEXT DEFAULT 'AZ',
  value_tier INTEGER NOT NULL,
  tier_name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,
  price_annual INTEGER NOT NULL,
  zip_codes TEXT[] NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_arizona_city_slug ON arizona_city_pricing(city_slug);
CREATE INDEX idx_arizona_city_tier ON arizona_city_pricing(value_tier);
CREATE INDEX idx_arizona_city_active ON arizona_city_pricing(is_active);

ALTER TABLE arizona_city_pricing ENABLE ROW LEVEL SECURITY;

CREATE TABLE agent_city_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES arizona_city_pricing(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL,
  price_paid INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(professional_id, city_id)
);

CREATE INDEX idx_agent_city_subs_professional ON agent_city_subscriptions(professional_id);
CREATE INDEX idx_agent_city_subs_city ON agent_city_subscriptions(city_id);
CREATE INDEX idx_agent_city_subs_active ON agent_city_subscriptions(is_active);

ALTER TABLE agent_city_subscriptions ENABLE ROW LEVEL SECURITY;