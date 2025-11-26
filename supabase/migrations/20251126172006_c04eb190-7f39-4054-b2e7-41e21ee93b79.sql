-- Add og_image_url column to professionals table
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS og_image_url TEXT;