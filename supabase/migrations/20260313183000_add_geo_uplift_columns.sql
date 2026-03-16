-- Add GEO uplift analysis columns to professionals table
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS recommendation_without text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS recommendation_with text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS uplift text;
