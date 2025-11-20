-- Enable realtime for professionals table so frontend can receive updates as agents are enriched
ALTER TABLE public.professionals REPLICA IDENTITY FULL;

-- The table is automatically added to supabase_realtime publication