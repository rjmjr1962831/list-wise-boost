-- Update default location to Zoom Meeting
ALTER TABLE public.appointments 
ALTER COLUMN location SET DEFAULT 'Zoom Meeting';