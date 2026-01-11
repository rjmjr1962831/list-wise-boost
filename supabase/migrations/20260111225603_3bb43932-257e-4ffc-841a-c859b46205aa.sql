-- Create zip_adjacency table for ZIP-to-ZIP proximity data
CREATE TABLE IF NOT EXISTS public.zip_adjacency (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_code TEXT NOT NULL,
    adjacent_zip TEXT NOT NULL,
    distance_miles DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zip_code, adjacent_zip)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_zip_adjacency_zip ON public.zip_adjacency(zip_code);
CREATE INDEX IF NOT EXISTS idx_zip_adjacency_adjacent ON public.zip_adjacency(adjacent_zip);

-- Enable RLS but allow public read access
ALTER TABLE public.zip_adjacency ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read zip adjacency data (public reference data)
CREATE POLICY "Allow public read access to zip_adjacency" 
ON public.zip_adjacency 
FOR SELECT 
USING (true);