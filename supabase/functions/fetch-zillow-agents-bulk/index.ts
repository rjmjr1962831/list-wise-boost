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
    
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')?.trim();
    const RAPIDAPI_HOST = Deno.env.get('RAPIDAPI_HOST')?.trim();
    const OUTSCRAPER_API_KEY = Deno.env.get('OUTSCRAPER_API_KEY')?.trim();
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();

    const query = `real estate agent in ${city}, ${state}`;
    console.log(`Agent discovery query: ${query}`);

    async function tryRapidAPI() {
      if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
        console.warn('RapidAPI not configured');
        return [] as any[];
      }

      const baseUrl = `https://${RAPIDAPI_HOST}`;
      const paths = RAPIDAPI_HOST.includes('local-business-data')
        ? ['/search']
        : ['/maps/search', '/search', '/places', '/textsearch'];

      for (const path of paths) {
        try {
          const url = new URL(path, baseUrl);
          url.searchParams.set('query', query);
          url.searchParams.set('limit', '15');
          const resp = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': RAPIDAPI_HOST,
            },
          });
          if (!resp.ok) {
            const t = await resp.text();
            console.warn(`RapidAPI ${path} error:`, resp.status, t);
            if (resp.status === 404) continue;
            continue;
          }
          const json = await resp.json();
          const data = Array.isArray(json) ? json : (json.data || json.results || json.items || []);
          if (Array.isArray(data) && data.length > 0) {
            console.log(`RapidAPI ${path} returned ${data.length} results`);
            return data;
          }
        } catch (e) {
          console.warn(`RapidAPI ${path} exception:`, e);
          continue;
        }
      }
      return [] as any[];
    }

    async function tryOutscraper() {
      if (!OUTSCRAPER_API_KEY) {
        console.warn('Outscraper not configured');
        return [] as any[];
      }
      const searchUrl = new URL('https://api.app.outscraper.com/maps/search-v3');
      searchUrl.searchParams.append('query', query);
      searchUrl.searchParams.append('limit', '15');
      searchUrl.searchParams.append('language', 'en');
      searchUrl.searchParams.append('region', 'us');
      const resp = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.warn('Outscraper search error:', resp.status, t);
        return [] as any[];
      }
      const json = await resp.json();
      const data = json.data?.[0] || [];
      console.log(`Outscraper returned ${data.length} results`);
      return data;
    }

    async function tryApifyZillow() {
      if (!APIFY_API_TOKEN) {
        console.warn('Apify not configured');
        return [] as any[];
      }
      
      const actorId = 'getdataforme~zillow-real-state-agents-scraper';
      const location = `${city}, ${state}`;
      console.log(`Trying Apify Zillow scraper for: ${location}`);

      const apifyInput = {
        location: location,
      };

      const startResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput),
      });

      if (!startResp.ok) {
        const t = await startResp.text();
        console.warn('Apify start error:', startResp.status, t);
        return [] as any[];
      }

      const run = await startResp.json();
      const runId = run.data.id;

      // Poll for completion (max 60s)
      let status = run.data.status;
      let attempts = 0;
      while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_API_TOKEN}`);
        if (!statusResp.ok) break;
        const statusData = await statusResp.json();
        status = statusData.data.status;
        attempts++;
      }

      if (status !== 'SUCCEEDED') {
        console.warn('Apify run did not succeed:', status);
        return [] as any[];
      }

      const datasetId = run.data.defaultDatasetId;
      const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
      if (!dataResp.ok) {
        console.warn('Apify dataset fetch failed');
        return [] as any[];
      }

      const items = await dataResp.json();
      console.log(`Apify Zillow returned ${items.length} results, limiting to 15`);
      return items.slice(0, 15); // Only return top 15
    }

    function mapAgent(agent: any, source: string) {
      // Handle Apify Zillow scraper format (capital case column names)
      const name = agent['Business Name'] || agent.name || agent.title || agent.fullName || '';
      const phone = agent['Phone Number'] || agent.phone || agent.phoneNumber || agent.call_number || null;
      const website = agent['Website'] || agent.website || agent.site || agent.domain || agent.profileLink || null;
      const thumbnail = agent['Profile Photo'] || agent.thumbnail || agent.logo || agent.photo || agent.profilePhotoSrc || null;
      const address = agent['Address'] || agent.address || agent.full_address || agent.location || '';
      const rating = agent['Rating'] || agent.rating || agent.stars || agent.score || 4.5;
      const reviews = agent['Review Count'] || agent.reviews || agent.review_count || agent.reviews_count || agent.reviewCount || 0;
      
      let categories: string[] = [];
      if (Array.isArray(agent.categories)) {
        categories = agent.categories;
      } else if (agent.subtypes) {
        categories = String(agent.subtypes).split(',');
      } else if (agent.category) {
        categories = [agent.category];
      } else if (agent.specialties && Array.isArray(agent.specialties)) {
        categories = agent.specialties;
      }

      const categoryText = categories.join(' ').toLowerCase();
      const isRealEstateAgent = categoryText.includes('real estate') || 
                                 categoryText.includes('realtor') ||
                                 source === 'apify-zillow'; // Zillow scraper only returns agents

      return {
        isRealEstateAgent,
        fullName: name,
        name,
        email: website ? `info@${String(website).replace(/https?:\/\/(www\.)?/, '').split('/')[0]}` : null,
        phone,
        website,
        profilePhotoSrc: thumbnail,
        profileLink: website,
        company: name.includes(',') ? name.split(',')[1].trim() : 'Independent Agent',
        rating,
        reviewCount: reviews,
        numTotalReviews: reviews,
        specialties: extractSpecialtiesFromCategories(categories),
        address,
        reviews: [],
        totalSales: Math.floor(reviews / 8),
        currentListings: Math.max(1, Math.floor(reviews / 100)),
      };
    }

    // Try providers in order: RapidAPI -> Outscraper -> Apify Zillow
    let rawAgents: any[] = [];
    let source = '';
    
    rawAgents = await tryRapidAPI();
    if (rawAgents && rawAgents.length > 0) {
      source = 'rapidapi';
    } else {
      rawAgents = await tryOutscraper();
      if (rawAgents && rawAgents.length > 0) {
        source = 'outscraper';
      } else {
        rawAgents = await tryApifyZillow();
        source = 'apify-zillow';
      }
    }

    console.log(`Using source: ${source}, raw count: ${rawAgents.length}`);

    const transformedAgents = (rawAgents || [])
      .map(a => mapAgent(a, source))
      .filter((a) => a && a.isRealEstateAgent && a.name)
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

