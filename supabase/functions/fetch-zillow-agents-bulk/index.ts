import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyAgentData {
  encodedZuid?: string;
  screenName?: string;
  name?: string;
  businessName?: string;
  profilePhotoSrc?: string;
  phoneNumbers?: {
    cell?: string;
    business?: string;
    brokerage?: string;
  };
  email?: string;
  url?: string;
  businessAddress?: {
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  ratings?: {
    count?: number;
    average?: number;
  };
  agentSalesStats?: {
    countAllTime?: number;
    countLastYear?: number;
    priceRangeThreeYearMin?: number;
    priceRangeThreeYearMax?: number;
  };
  forSaleListings?: {
    listing_count?: number;
  };
  reviewsData?: {
    reviews?: Array<{
      reviewComment?: string;
      reviewRating?: number;
      reviewee?: {
        screenName?: string;
      };
    }>;
  };
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
    console.log(`Starting bulk Zillow scrape for ${location} using memo23 actor`);

    // Get zip code for the city (we'll need to enhance this later)
    // For now, we'll use a search URL format that works with the actor
    const searchUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}/`;
    
    console.log(`Search URL: ${searchUrl}`);

    // Start the Apify actor run with memo23/apify-zillow-agents-cheerio
    const actorRunResponse = await fetch(
      'https://api.apify.com/v2/acts/memo23~apify-zillow-agents-cheerio/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_API_TOKEN}`,
        },
        body: JSON.stringify({
          startUrls: [
            { url: searchUrl }
          ],
          maxConcurrency: 50,
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
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
        `https://api.apify.com/v2/acts/memo23~apify-zillow-agents-cheerio/runs/${runId}`,
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
      .filter(agent => {
        const name = agent.screenName || agent.name;
        const phone = agent.phoneNumbers?.cell || agent.phoneNumbers?.business;
        return name && phone; // Only agents with name and phone
      })
      .slice(0, 10) // Take top 10
      .map((agent, index) => {
        const fullName = agent.screenName || agent.name || "Unknown Agent";
        const phone = agent.phoneNumbers?.cell || agent.phoneNumbers?.business || agent.phoneNumbers?.brokerage || null;
        const address = agent.businessAddress 
          ? `${agent.businessAddress.address1 || ''}, ${agent.businessAddress.city || ''}, ${agent.businessAddress.state || ''} ${agent.businessAddress.postalCode || ''}`.trim()
          : '';
        
        return {
          fullName,
          name: fullName,
          email: agent.email || null,
          phone,
          website: agent.url || null,
          profilePhotoSrc: agent.profilePhotoSrc || null,
          profileLink: agent.url || null,
          company: agent.businessName || 'Independent Agent',
          rating: agent.ratings?.average || 4.5,
          reviewCount: agent.ratings?.count || 0,
          numTotalReviews: agent.ratings?.count || 0,
          specialties: ["Buyer's Agent", "Listing Agent"], // Default specialties
          address,
          reviews: agent.reviewsData?.reviews?.slice(0, 3).map(review => ({
            text: review.reviewComment || '',
            rating: review.reviewRating || 5,
            author: review.reviewee?.screenName || 'Client',
            date: new Date().toISOString(),
          })) || [],
          totalSales: agent.agentSalesStats?.countAllTime || 0,
          salesLast12Mo: agent.agentSalesStats?.countLastYear || 0,
          currentListings: agent.forSaleListings?.listing_count || 0,
          zuid: agent.encodedZuid || null,
          priceRangeMin: agent.agentSalesStats?.priceRangeThreeYearMin || null,
          priceRangeMax: agent.agentSalesStats?.priceRangeThreeYearMax || null,
        };
      });

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

