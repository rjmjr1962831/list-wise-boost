CREATE TABLE public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_number TEXT NOT NULL,
  brokerage TEXT NOT NULL,
  years_licensed INTEGER,
  estimated_transactions TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_requests_status ON public.review_requests(status);
CREATE INDEX idx_review_requests_created_at ON public.review_requests(created_at DESC);
CREATE INDEX idx_review_requests_email ON public.review_requests(email);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;