import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutscraperRequest {
  profileUrl: string;
}

function toInt(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/[^0-9]/g, '');
  return str ? parseInt(str, 10) : 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl }: OutscraperRequest = await req.json();
    if (!profileUrl) throw new Error('profileUrl is required');

    const apiKey = Deno.env.get('OUTSCRAPER_API_KEY');
    if (!apiKey) throw new Error('OUTSCRAPER_API_KEY not configured');

    console.log('Fetching Outscraper data for:', profileUrl);

    // Use Zillow Search API with agent profile URL as query
    const params = new URLSearchParams({
      query: profileUrl,
      limit: '1',
      async: 'false', // Synchronous for immediate response
    });

    const resp = await fetch(
      `https://api.app.outscraper.com/zillow/search?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Outscraper API error:', resp.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Outscraper API error ${resp.status}`,
          details: errorText,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await resp.json();
    console.log('Outscraper response:', JSON.stringify(data, null, 2));

    // Response structure: { data: [{ query: "...", listings: [...] }] }
    const queryResult = Array.isArray(data?.data) ? data.data[0] : null;
    const listings = Array.isArray(queryResult?.listings) ? queryResult.listings : [];

    if (listings.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No listings found for this agent',
          stats: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent stats from the first listing's agent profile
    const firstListing = listings[0];
    const agent = firstListing?.agent_profile || {};

    const stats = {
      forSale: toInt(agent.for_sale ?? agent.agent_profile_for_sale),
      sold: toInt(agent.total_sales ?? agent.agent_profile_total_sales),
      forRent: toInt(agent.for_rent ?? agent.agent_profile_for_rent),
      reviews: toInt(agent.reviews ?? agent.agent_profile_reviews),
      currentListings: toInt(agent.for_sale ?? agent.agent_profile_for_sale),
      totalSales: toInt(agent.total_sales ?? agent.agent_profile_total_sales),
      yearsExperience: toInt(agent.years_of_experience ?? agent.agent_profile_years_of_experience),
    };

    console.log('Mapped stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        source: 'outscraper',
        rawData: agent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-outscraper-agent-stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
