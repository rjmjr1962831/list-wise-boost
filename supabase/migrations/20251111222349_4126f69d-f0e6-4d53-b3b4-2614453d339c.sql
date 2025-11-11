-- Add listing and sales count fields to professionals table
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS current_listings integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sales integer DEFAULT 0;

COMMENT ON COLUMN public.professionals.current_listings IS 'Number of current active listings';
COMMENT ON COLUMN public.professionals.total_sales IS 'Total number of completed sales/transactions';