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

    // Use Zillow Profiles API with agent profile URL
    const resp = await fetch(
      'https://api.app.outscraper.com/zillow/profiles',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: [profileUrl],
          async: false,
        }),
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      console.warn('Outscraper API error:', resp.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Outscraper API error ${resp.status}`,
          details: errorText,
          stats: null,
          source: 'outscraper'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await resp.json();
    console.log('Outscraper response:', JSON.stringify(data, null, 2));

    // Response structure: { data: [{ agent_profile_name, agent_profile_for_sale, ... }] }
    const profiles = Array.isArray(data?.data) ? data.data : [];

    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No profile found for this agent',
          stats: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent stats from the first profile
    const profile = profiles[0];

    const stats = {
      forSale: toInt(profile.agent_profile_for_sale),
      sold: toInt(profile.agent_profile_total_sales),
      forRent: toInt(profile.agent_profile_for_rent),
      reviews: toInt(profile.agent_profile_reviews),
      currentListings: toInt(profile.agent_profile_for_sale),
      totalSales: toInt(profile.agent_profile_total_sales),
      yearsExperience: toInt(profile.agent_profile_years_of_experience),
    };

    console.log('Mapped stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        source: 'outscraper',
        rawData: profile,
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
