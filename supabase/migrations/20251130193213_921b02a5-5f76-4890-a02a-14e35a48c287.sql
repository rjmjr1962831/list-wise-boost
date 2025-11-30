-- Create pricing_plans table
CREATE TABLE public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_annual DECIMAL(10,2),
  features JSONB DEFAULT '[]'::jsonb,
  cities_included INTEGER DEFAULT 1,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active pricing plans"
ON public.pricing_plans
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage pricing plans"
ON public.pricing_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed pricing plans
INSERT INTO public.pricing_plans (name, slug, description, price_monthly, price_annual, features, cities_included, is_featured, display_order)
VALUES 
(
  'Free',
  'free',
  'Get started with one city and AI-optimized profile',
  0.00,
  0.00,
  '["AI-optimized profile", "1 city listing", "Rotating placement in search results", "Basic analytics"]'::jsonb,
  1,
  false,
  1
),
(
  'Pro',
  'pro',
  'Expand your reach across multiple cities',
  49.00,
  470.00,
  '["Featured placement", "3 city listings", "Priority search ranking", "Advanced analytics", "Social media integration", "Direct messaging"]'::jsonb,
  3,
  true,
  2
),
(
  'Premium',
  'premium',
  'Dominate your market with maximum visibility',
  99.00,
  950.00,
  '["Top placement guaranteed", "10 city listings", "Premium badge", "Enhanced profile features", "Dedicated support", "Custom integrations", "Press mention amplification"]'::jsonb,
  10,
  false,
  3
);

-- Add new columns to professionals table
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS headline TEXT,
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS social_linkedin TEXT,
ADD COLUMN IF NOT EXISTS social_facebook TEXT,
ADD COLUMN IF NOT EXISTS social_instagram TEXT,
ADD COLUMN IF NOT EXISTS funnel_status TEXT DEFAULT 'welcome',
ADD COLUMN IF NOT EXISTS funnel_completed_at TIMESTAMPTZ;

-- Create funnel_events table for tracking
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view funnel events"
ON public.funnel_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));