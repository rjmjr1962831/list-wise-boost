-- Create agent_neighborhood_subscriptions table
CREATE TABLE IF NOT EXISTS public.agent_neighborhood_subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_agent_neighborhood_subs_professional ON public.agent_neighborhood_subscriptions(professional_id);
CREATE INDEX IF NOT EXISTS idx_agent_neighborhood_subs_neighborhood ON public.agent_neighborhood_subscriptions(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_agent_neighborhood_subs_active ON public.agent_neighborhood_subscriptions(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_neighborhood_subs_unique ON public.agent_neighborhood_subscriptions(professional_id, neighborhood_id) WHERE is_active = true;

ALTER TABLE public.agent_neighborhood_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON public.agent_neighborhood_subscriptions;
CREATE POLICY "Public read access" ON public.agent_neighborhood_subscriptions FOR SELECT USING (true);

-- Create zip_adjacency table
CREATE TABLE IF NOT EXISTS public.zip_adjacency (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_code TEXT NOT NULL,
    adjacent_zip TEXT NOT NULL,
    distance_miles DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zip_code, adjacent_zip)
);

CREATE INDEX IF NOT EXISTS idx_zip_adjacency_zip ON public.zip_adjacency(zip_code);
CREATE INDEX IF NOT EXISTS idx_zip_adjacency_adjacent ON public.zip_adjacency(adjacent_zip);

ALTER TABLE public.zip_adjacency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access zip" ON public.zip_adjacency;
CREATE POLICY "Public read access zip" ON public.zip_adjacency FOR SELECT USING (true);

-- Create agent_zip_activity table
CREATE TABLE IF NOT EXISTS agent_zip_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_number TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 1,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_agent_zip UNIQUE (license_number, state, zip_code)
);

ALTER TABLE agent_zip_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access activity" ON agent_zip_activity;
CREATE POLICY "Public read access activity" ON agent_zip_activity FOR SELECT USING (true);
