-- Phase 1: Create payment_transactions table for financial history
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id),
  stripe_event_id TEXT UNIQUE NOT NULL,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  stripe_charge_id TEXT,
  event_type TEXT NOT NULL, -- 'charge.succeeded', 'charge.failed', 'charge.refunded', 'invoice.payment_failed'
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  promo_code TEXT,
  discount_amount_cents INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- 'succeeded', 'failed', 'refunded', 'pending'
  failure_reason TEXT,
  cities_purchased TEXT[], -- array of city names
  package_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can manage payment transactions
CREATE POLICY "Admins can manage payment transactions"
ON public.payment_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add funnel/payment tracking columns to professionals
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS funnel_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS promo_code_used TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS monthly_revenue_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_status TEXT,
ADD COLUMN IF NOT EXISTS cities_subscribed TEXT[];

-- Create index for payment lookups
CREATE INDEX idx_payment_transactions_professional ON public.payment_transactions(professional_id);
CREATE INDEX idx_payment_transactions_stripe_sub ON public.payment_transactions(stripe_subscription_id);
CREATE INDEX idx_professionals_subscription_status ON public.professionals(subscription_status) WHERE subscription_status != 'none';