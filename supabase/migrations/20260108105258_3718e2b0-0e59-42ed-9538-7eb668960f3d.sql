-- Table 1: agent_verification_codes - stores 6-digit codes with 10-minute expiry
CREATE TABLE public.agent_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  code text NOT NULL,
  delivery_method text NOT NULL DEFAULT 'email',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz NULL
);

-- Indexes for fast lookups
CREATE INDEX idx_agent_verification_codes_code_expires ON public.agent_verification_codes(code, expires_at);
CREATE INDEX idx_agent_verification_codes_professional_id ON public.agent_verification_codes(professional_id);
CREATE INDEX idx_agent_verification_codes_created_at ON public.agent_verification_codes(created_at);

-- RLS: No direct user access, all operations via edge functions with service role
ALTER TABLE public.agent_verification_codes ENABLE ROW LEVEL SECURITY;

-- Table 2: agent_sessions - stores session tokens with 24-hour rolling expiry
CREATE TABLE public.agent_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

-- Index for session lookups (UNIQUE already creates one on session_token)
CREATE INDEX idx_agent_sessions_expires_at ON public.agent_sessions(expires_at);
CREATE INDEX idx_agent_sessions_professional_id ON public.agent_sessions(professional_id);

-- RLS: No direct user access, all operations via edge functions with service role
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- Table 3: agent_rate_limits - tracks failed verification attempts
CREATE TABLE public.agent_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  attempt_type text NOT NULL DEFAULT 'verification_failure',
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NULL
);

-- Index for fast lookups by email and time
CREATE INDEX idx_agent_rate_limits_email_created ON public.agent_rate_limits(email, created_at);
CREATE INDEX idx_agent_rate_limits_locked_until ON public.agent_rate_limits(locked_until);

-- RLS: No direct user access, all operations via edge functions with service role
ALTER TABLE public.agent_rate_limits ENABLE ROW LEVEL SECURITY;

-- TODO: Create scheduled job to purge expired records:
-- DELETE FROM agent_verification_codes WHERE expires_at < now() - interval '1 day'
-- DELETE FROM agent_sessions WHERE expires_at < now() - interval '1 day'
-- DELETE FROM agent_rate_limits WHERE created_at < now() - interval '1 day'