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
            // For non-404, try next provider
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

    function mapAgent(agent: any) {
      const name = agent.name || agent.title || '';
      const phone = agent.phone || agent.phoneNumber || agent.call_number || null;
      const website = agent.website || agent.site || agent.domain || null;
      const thumbnail = agent.thumbnail || agent.logo || agent.photo || null;
      const address = agent.address || agent.full_address || agent.location || '';
      const rating = agent.rating || agent.stars || agent.score || 4.5;
      const reviews = agent.reviews || agent.review_count || agent.reviews_count || 0;
      const categories = Array.isArray(agent.categories)
        ? agent.categories
        : (agent.subtypes ? String(agent.subtypes).split(',') : (agent.category ? [agent.category] : []));

      const categoryText = categories.join(' ').toLowerCase();
      const isRealEstateAgent = categoryText.includes('real estate') || categoryText.includes('realtor');

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

    // Try RapidAPI first, then Outscraper
    let rawAgents: any[] = await tryRapidAPI();
    if (!rawAgents || rawAgents.length === 0) {
      rawAgents = await tryOutscraper();
    }

    const transformedAgents = (rawAgents || [])
      .map(mapAgent)
      .filter((a) => a.isRealEstateAgent && a.name && a.phone)
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

