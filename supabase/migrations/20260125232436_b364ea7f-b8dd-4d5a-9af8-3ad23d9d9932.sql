-- Create storage bucket for data files if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('data', 'data', false)
ON CONFLICT (id) DO NOTHING;