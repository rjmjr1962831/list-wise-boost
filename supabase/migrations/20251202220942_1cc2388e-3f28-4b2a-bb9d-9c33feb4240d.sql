-- Add selection_rationale field to professionals table
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS selection_rationale TEXT;

-- Add selection_rationale_generated_at timestamp
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS selection_rationale_generated_at TIMESTAMP WITH TIME ZONE;