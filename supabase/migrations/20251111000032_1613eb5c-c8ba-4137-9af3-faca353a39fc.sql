-- Create marketing_content table for CMS-managed marketing page content
CREATE TABLE public.marketing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page TEXT NOT NULL,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page, section, key)
);

-- Enable RLS
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read marketing content
CREATE POLICY "Marketing content is viewable by everyone"
ON public.marketing_content
FOR SELECT
USING (true);

-- Only admins can insert marketing content
CREATE POLICY "Admins can insert marketing content"
ON public.marketing_content
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Only admins can update marketing content
CREATE POLICY "Admins can update marketing content"
ON public.marketing_content
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Only admins can delete marketing content
CREATE POLICY "Admins can delete marketing content"
ON public.marketing_content
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_content_updated_at
BEFORE UPDATE ON public.marketing_content
FOR EACH ROW
EXECUTE FUNCTION public.update_cms_updated_at();

-- Insert default content for main page
INSERT INTO public.marketing_content (page, section, key, value, type) VALUES
-- Hero section
('main', 'hero', 'badge_text', 'Position Yourself as a Trusted Expert', 'text'),
('main', 'hero', 'title', 'When AI Recommends the Best, <span class="text-primary">Your Name Appears.</span>', 'html'),
('main', 'hero', 'subtitle', 'Imagine a potential client asking ChatGPT or Google AI: <span class="font-semibold text-foreground">"Who are the top dentists in Gilbert?"</span> They''ll get a curated answer from Top10Lists.us—the authoritative directory AI engines trust.', 'html'),
('main', 'hero', 'cta_primary', 'Claim Your Spot', 'text'),
('main', 'hero', 'cta_secondary', 'View Sample List', 'text'),

-- What is section
('main', 'what_is', 'title', 'What Is Top10Lists.us?', 'text'),
('main', 'what_is', 'description', 'Top10Lists.us is a <span class="font-semibold text-foreground">curated directory of the top 10 service providers</span> in every major U.S. city—starting with high-trust professions like:', 'html'),

-- Why join section
('main', 'why_join', 'title', 'Why You Should Be on the List', 'text'),

-- Who for section
('main', 'who_for', 'title', 'Who This Is For', 'text'),
('main', 'who_for', 'subtitle', 'Top-tier service professionals who apply. Once past our screening and invited to be on the list, you choose your investment per month based on your business needs.', 'text'),

-- How it works section
('main', 'how_it_works', 'title', 'How to Get Listed', 'text'),
('main', 'how_it_works', 'subtitle', 'Join the curated directory that AI engines trust for local service recommendations', 'text'),

-- Industries section
('main', 'industries', 'title', 'Industries We Serve', 'text'),
('main', 'industries', 'subtitle', 'Specialized listings for service-based businesses across multiple sectors', 'text'),

-- Pricing section
('main', 'pricing', 'title', 'Cost & Value', 'text'),
('main', 'pricing', 'subtitle', 'Authority without the ad spend. One new client covers the cost.', 'text'),
('main', 'pricing', 'price', '$300', 'text'),
('main', 'pricing', 'period', '/month', 'text'),
('main', 'pricing', 'roi_text', 'Most professionals see 3–6x ROI within 12 months', 'text'),

-- Final CTA section
('main', 'final_cta', 'title', 'Claim Your Spot in the Top 10', 'text'),
('main', 'final_cta', 'description', 'Limited to just 10 providers per category per city. When customers ask AI for recommendations, make sure you''re on the list they see. Apply today.', 'text'),
('main', 'final_cta', 'cta_primary', 'Apply Now', 'text'),
('main', 'final_cta', 'cta_secondary', 'View Sample Lists', 'text');