-- Create table for agent email/SMS subscriptions
CREATE TABLE public.agent_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  consent BOOLEAN NOT NULL DEFAULT false,
  source TEXT DEFAULT 'agent-landing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on email to prevent duplicates
ALTER TABLE public.agent_subscriptions ADD CONSTRAINT agent_subscriptions_email_unique UNIQUE (email);

-- Enable RLS
ALTER TABLE public.agent_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for the form submission)
CREATE POLICY "Allow public insert" 
ON public.agent_subscriptions 
FOR INSERT 
WITH CHECK (true);

-- Only admins can view subscriptions
CREATE POLICY "Admins can view all subscriptions" 
ON public.agent_subscriptions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_agent_subscriptions_updated_at
BEFORE UPDATE ON public.agent_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();