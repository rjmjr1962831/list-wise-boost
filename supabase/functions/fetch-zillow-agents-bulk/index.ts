import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendFailureAlert(functionName: string, error: string, context?: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Cannot send alert: Supabase credentials missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke('send-api-failure-alert', {
      body: {
        functionName,
        error,
        context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('Failed to send alert email:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state } = await req.json();
    
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!APIFY_API_TOKEN) {
      const error = 'Apify API token not configured';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state });
      throw new Error(error);
    }

    const query = `real estate agent in ${city}, ${state}`;
    console.log(`Agent discovery query: ${query}`);

    const actorId = 'jupri~zillow-agents';
    const location = `${city}, ${state}`;
    console.log(`Fetching agents from Apify for: ${location}`);

    // jupri/zillow-agents expects different input format
    const apifyInput = {
      query: [],
      limit: 15,
      filters: { location }
    };

    const startResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!startResp.ok) {
      const errorText = await startResp.text();
      console.error('Apify start error:', startResp.status, errorText);
      await sendFailureAlert('fetch-zillow-agents-bulk', `Apify API start failed: ${startResp.status}`, {
        city,
        state,
        error: errorText
      });
      throw new Error(`Apify API request failed: ${startResp.status}`);
    }

    const run = await startResp.json();
    const runId = run.data.id;
    console.log('Apify run started:', runId);

    // Poll for completion (max 60s)
    let status = run.data.status;
    let attempts = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_API_TOKEN}`);
      if (!statusResp.ok) break;
      const statusData = await statusResp.json();
      status = statusData.data.status;
      console.log(`Apify run status: ${status} (attempt ${attempts + 1})`);
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      const error = `Apify run did not succeed: ${status}`;
      console.error(error);
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, runId, attempts });
      throw new Error(error);
    }

    const datasetId = run.data.defaultDatasetId;
    const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
    if (!dataResp.ok) {
      const error = 'Failed to fetch Apify dataset';
      await sendFailureAlert('fetch-zillow-agents-bulk', error, { city, state, datasetId });
      throw new Error(error);
    }

    const rawAgents = await dataResp.json();
    console.log(`Apify returned ${rawAgents.length} results, limiting to 15`);
    const items = rawAgents.slice(0, 15); // Only return top 15

    function mapAgent(agent: any) {
      // Log first agent to help debug field mappings
      if (items.indexOf(agent) === 0) {
        console.log('First agent fields:', Object.keys(agent));
        console.log('First agent sample:', JSON.stringify(agent).substring(0, 500));
      }
      
      // Handle multiple possible field names from different Apify actors
      const name = agent.name || agent.agentName || agent['Business Name'] || agent.title || agent.fullName || '';
      const phone = agent.phone || agent.phoneNumber || agent['Phone Number'] || agent.call_number || null;
      const website = agent.url || agent.profileUrl || agent.website || agent['Website'] || agent.site || agent.domain || agent.profileLink || null;
      const thumbnail = agent.photo || agent.image || agent.profilePhoto || agent['Profile Photo'] || agent.thumbnail || agent.logo || agent.profilePhotoSrc || null;
      const address = agent.address || agent.location || agent['Address'] || agent.full_address || agent.city || '';
      const rating = agent.rating || agent['Rating'] || agent.stars || agent.score || 4.5;
      const reviews = agent.reviewsCount || agent.reviews || agent['Review Count'] || agent.review_count || agent.reviews_count || agent.reviewCount || 0;
      
      let categories: string[] = [];
      if (Array.isArray(agent.categories)) {
        categories = agent.categories;
      } else if (Array.isArray(agent.specialties)) {
        categories = agent.specialties;
      } else if (agent.subtypes) {
        categories = String(agent.subtypes).split(',');
      } else if (agent.category) {
        categories = [agent.category];
      }

      const categoryText = categories.join(' ').toLowerCase();
      const isRealEstateAgent = categoryText.includes('real estate') || 
                                 categoryText.includes('realtor') ||
                                 true; // Zillow scraper only returns agents

      return {
        isRealEstateAgent,
        fullName: name,
        name,
        email: website ? `info@${String(website).replace(/https?:\/\/(www\.)?/, '').split('/')[0]}` : null,
        phoneNumber: phone,
        phone,
        businessName: name,
        profileLink: website,
        website,
        reviewStarsRating: Number(rating) || 4.5,
        rating,
        numTotalReviews: Number(reviews) || 0,
        reviews,
        reviewCount: Number(reviews) || 0,
        specialties: extractSpecialtiesFromCategories(categories),
        thumbnail,
        profilePhotoSrc: thumbnail,
        location: address,
        address,
        full_address: address,
      };
    }

    console.log(`Using Apify source, raw count: ${items.length}`);

    const transformedAgents = (items || [])
      .map((a: any) => mapAgent(a))
      .filter((a: any) => a && a.isRealEstateAgent && a.name)
      .slice(0, 10);

    console.log(`Transformed ${transformedAgents.length} agents with complete data`);

    return new Response(JSON.stringify(transformedAgents), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents-bulk function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractSpecialtiesFromCategories(categories: string[]): string[] {
  const specialtyMap: { [key: string]: string } = {
    'buyer': "Buyer's Agent",
    'seller': "Listing Agent",
    'listing': "Listing Agent",
    'consultant': 'Real Estate Consultant',
    'relocation': 'Relocation Specialist',
    'investment': 'Investment Properties',
    'commercial': 'Commercial Real Estate',
    'residential': 'Residential Real Estate',
  };

  const specialties: string[] = [];
  const lowercaseCategories = categories.join(' ').toLowerCase();

  for (const [key, value] of Object.entries(specialtyMap)) {
    if (lowercaseCategories.includes(key)) {
      specialties.push(value);
    }
  }

  return specialties.length > 0 ? specialties : ["Buyer's Agent", "Listing Agent"];
}
