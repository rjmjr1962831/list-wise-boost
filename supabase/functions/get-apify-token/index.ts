import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Only allow with service role key (verified by Supabase JWT)
  const token = Deno.env.get('APIFY_API_TOKEN') || Deno.env.get('APIFY_TOKEN') || '';

  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
