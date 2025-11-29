-- Create professional_cities junction table for multi-city support
CREATE TABLE IF NOT EXISTS professional_cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, city_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_professional_cities_city ON professional_cities(city_id) WHERE active = true;
CREATE INDEX idx_professional_cities_professional ON professional_cities(professional_id);
CREATE INDEX idx_professional_cities_rank ON professional_cities(city_id, rank) WHERE active = true;

-- Enable RLS
ALTER TABLE professional_cities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view professional cities" ON professional_cities
  FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage professional cities" ON professional_cities
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add is_brand_builder column to professionals
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS is_brand_builder BOOLEAN DEFAULT false;

-- Create index for Brand Builders
CREATE INDEX idx_professionals_brand_builder ON professionals(is_brand_builder) WHERE is_brand_builder = true;

-- Migrate existing data: Create professional_cities entries for all existing professionals
INSERT INTO professional_cities (professional_id, city_id, rank, active)
SELECT id, city_id, rank, active
FROM professionals
WHERE city_id IS NOT NULL
ON CONFLICT (professional_id, city_id) DO NOTHING;