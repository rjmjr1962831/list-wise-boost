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
    
    if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
      throw new Error('RapidAPI key or host not configured');
    }

    const query = `real estate agent in ${city}, ${state}`;
    console.log(`Searching Google Places via RapidAPI for: ${query}`);

    // Use RapidAPI Google Maps API to search for real estate agents
    const searchUrl = new URL('https://google-maps-scraper.p.rapidapi.com/maps/search');
    searchUrl.searchParams.append('query', query);
    searchUrl.searchParams.append('limit', '15');

    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('RapidAPI search error:', searchResponse.status, errorText);
      throw new Error(`Failed to search Google Places: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    console.log(`RapidAPI returned ${searchData.data?.length || 0} results`);

    // Transform RapidAPI data to our format
    const agents = searchData.data || [];

    // Transform RapidAPI data to our format
    const transformedAgents = agents
      .filter((agent: any) => {
        // Filter for real estate agents with contact info
        const categoryText = (agent.categories || []).join(' ').toLowerCase();
        const isRealEstateAgent = categoryText.includes('real estate') || 
                                   categoryText.includes('realtor');
        return agent.name && agent.phone && isRealEstateAgent;
      })
      .slice(0, 10) // Take top 10
      .map((agent: any, index: number) => {
        // Extract email from website or generate placeholder
        const email = agent.website 
          ? `info@${agent.website.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}` 
          : null;

        return {
          fullName: agent.name,
          name: agent.name,
          email,
          phone: agent.phone || null,
          website: agent.website || null,
          profilePhotoSrc: agent.thumbnail || null,
          profileLink: agent.website || null,
          company: agent.name.includes(',') ? agent.name.split(',')[1].trim() : 'Independent Agent',
          rating: agent.rating || 4.5,
          reviewCount: agent.reviews || 0,
          numTotalReviews: agent.reviews || 0,
          specialties: extractSpecialtiesFromCategories(agent.categories || []),
          address: agent.address || '',
          reviews: [],
          // Estimate stats based on review count
          totalSales: Math.floor((agent.reviews || 0) / 8),
          currentListings: Math.max(1, Math.floor((agent.reviews || 0) / 100)),
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

