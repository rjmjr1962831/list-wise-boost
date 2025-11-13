import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyAgentData {
  name: string;
  name_for_emails?: string;
  phone?: string;
  site?: string;
  rating?: number;
  reviews?: number;
  reviews_data?: Array<{
    review_text: string;
    review_rating: number;
    author_title: string;
    review_datetime_utc: string;
  }>;
  subtypes?: string;
  full_address?: string;
  logo?: string;
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state } = await req.json();
    
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();
    
    if (!APIFY_API_TOKEN) {
      throw new Error('Apify API token not configured');
    }

    const location = `${city}, ${state}`;
    console.log(`Starting bulk Zillow scrape for ${location}`);

    // Start the Apify actor run with the new comprehensive scraper
    const actorRunResponse = await fetch(
      'https://api.apify.com/v2/acts/compass~zillow-real-estate-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify({
          query: location,
          maxItems: 165, // Get comprehensive results
          proxyConfiguration: {
            useApifyProxy: true,
          },
        }),
      }
    );

    if (!actorRunResponse.ok) {
      const errorText = await actorRunResponse.text();
      console.error('Apify actor start error:', actorRunResponse.status, errorText);
      throw new Error(`Failed to start Apify actor: ${actorRunResponse.status}`);
    }

    const runData = await actorRunResponse.json();
    const runId = runData.data.id;
    const defaultDatasetId = runData.data.defaultDatasetId;
    
    console.log(`Actor run started: ${runId}`);

    // Poll for completion (max 60 attempts, 2 second intervals = 2 minutes max)
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/compass~zillow-real-estate-scraper/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      const statusData = await statusResponse.json();
      const status = statusData.data.status;
      
      console.log(`Status check ${attempts}: ${status}`);

      if (status === 'SUCCEEDED') {
        completed = true;
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Actor run ${status.toLowerCase()}`);
      }
    }

    if (!completed) {
      throw new Error('Actor run timed out');
    }

    // Fetch the results from the dataset
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${defaultDatasetId}/items`,
      {
        headers: {
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
      }
    );

    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }

    const agents: ApifyAgentData[] = await datasetResponse.json();
    console.log(`Successfully scraped ${agents.length} agents`);

    // Transform Apify data to our format
    const transformedAgents = agents
      .filter(agent => agent.name && agent.phone) // Only agents with name and phone
      .slice(0, 10) // Take top 10
      .map((agent, index) => ({
        fullName: agent.name,
        name: agent.name,
        email: agent.name_for_emails ? `${agent.name_for_emails.toLowerCase().replace(/\s+/g, '')}@example.com` : null,
        phone: agent.phone || null,
        website: agent.site || null,
        profilePhotoSrc: agent.logo || null,
        profileLink: agent.site || null,
        company: extractCompanyName(agent.subtypes || agent.category || ''),
        rating: agent.rating || 4.5,
        reviewCount: agent.reviews || 0,
        numTotalReviews: agent.reviews || 0,
        specialties: extractSpecialties(agent.subtypes || ''),
        address: agent.full_address || '',
        reviews: agent.reviews_data?.slice(0, 3).map(review => ({
          text: review.review_text,
          rating: review.review_rating,
          author: review.author_title,
          date: review.review_datetime_utc,
        })) || [],
        // Estimate stats based on review count
        totalSales: Math.floor((agent.reviews || 0) / 8),
        currentListings: Math.max(1, Math.floor((agent.reviews || 0) / 100)),
      }));

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

function extractCompanyName(subtypes: string): string {
  // Extract company name from subtypes string
  const types = subtypes.split(',').map(s => s.trim());
  for (const type of types) {
    if (type.toLowerCase().includes('agency') || 
        type.toLowerCase().includes('group') || 
        type.toLowerCase().includes('team')) {
      return type;
    }
  }
  return types[0] || 'Independent Agent';
}

function extractSpecialties(subtypes: string): string[] {
  const specialtyMap: { [key: string]: string } = {
    'buyer': "Buyer's Agent",
    'seller': "Listing Agent",
    'consultant': 'Real Estate Consultant',
    'relocation': 'Relocation Specialist',
    'investment': 'Investment Properties',
  };

  const specialties: string[] = [];
  const lowercaseSubtypes = subtypes.toLowerCase();

  for (const [key, value] of Object.entries(specialtyMap)) {
    if (lowercaseSubtypes.includes(key)) {
      specialties.push(value);
    }
  }

  return specialties.length > 0 ? specialties : ["Buyer's Agent", "Listing Agent"];
}
