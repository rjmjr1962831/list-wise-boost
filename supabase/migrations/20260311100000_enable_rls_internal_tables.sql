-- Enable RLS on all internal CRM/email tables
-- These tables are only accessed by edge functions via service_role key (bypasses RLS)
-- Deny-all by default: no permissive policies needed

-- Email Sequencer v2 tables
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_volume ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- CRM tables
ALTER TABLE public.crm_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_activity ENABLE ROW LEVEL SECURITY;

-- Fix aics_export view: set security_invoker so it uses the querying user's permissions
ALTER VIEW public.aics_export SET (security_invoker = true);
