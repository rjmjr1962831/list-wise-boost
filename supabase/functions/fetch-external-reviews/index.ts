import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReqBody {
  agentName: string;
  company?: string;
  location?: string; // e.g., "Gilbert, Arizona"
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, company, location }: ReqBody = await req.json();
    if (!agentName) throw new Error('agentName is required');

    // TODO: Integrate Google/Yelp/Facebook providers (Outscraper/Apify). For now, return empty set gracefully.
    return new Response(
      JSON.stringify({ reviews: [], sources: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('fetch-external-reviews error:', error);
    return new Response(
      JSON.stringify({ reviews: [], sources: [], error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
