import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state } = await req.json();
    
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')?.trim();
    const RAPIDAPI_HOST = Deno.env.get('RAPIDAPI_HOST')?.trim();

    if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
      throw new Error('RapidAPI credentials not configured');
    }

    // Capitalize city and ensure state is uppercase
    const formattedCity = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    const formattedState = state.toUpperCase();
    
    console.log(`Fetching agents for ${formattedCity}, ${formattedState}`);

    // Call RapidAPI Zillow endpoint - using search_agents endpoint
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/search_agents?location=${encodeURIComponent(formattedCity + ', ' + formattedState)}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RapidAPI error:', response.status, errorText);
      throw new Error(`RapidAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched agent data');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
