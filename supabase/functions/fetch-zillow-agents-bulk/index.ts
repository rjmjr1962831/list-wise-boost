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
    
    const OUTSCRAPER_API_KEY = Deno.env.get('OUTSCRAPER_API_KEY')?.trim();
    
    if (!OUTSCRAPER_API_KEY) {
      throw new Error('Outscraper API key not configured');
    }

    const query = `real estate agent ${city}, ${state}`;
    console.log(`Searching Google Places for: ${query}`);

    // Use Outscraper Google Maps API to search for real estate agents
    const searchUrl = new URL('https://api.app.outscraper.com/maps/search-v3');
    searchUrl.searchParams.append('query', query);
    searchUrl.searchParams.append('limit', '15'); // Get 15 results to filter down to 10
    searchUrl.searchParams.append('language', 'en');
    searchUrl.searchParams.append('region', 'us');

    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Outscraper search error:', searchResponse.status, errorText);
      throw new Error(`Failed to search Google Places: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    console.log(`Outscraper returned ${searchData.data?.[0]?.length || 0} results`);

    // Transform Outscraper data to our format
    const agents = searchData.data?.[0] || [];

    // Transform Apify data to our format
    const transformedAgents = agents
      .filter((agent: any) => {
        // Filter for real estate agents with contact info
        const isRealEstateAgent = (agent.category || '').toLowerCase().includes('real estate') ||
                                   (agent.type || '').toLowerCase().includes('real estate') ||
                                   (agent.subtypes || '').toLowerCase().includes('real estate');
        return agent.name && agent.phone && isRealEstateAgent;
      })
      .slice(0, 10) // Take top 10
      .map((agent: any, index: number) => {
        // Extract email from name_for_emails if available
        const email = agent.name_for_emails 
          ? `${agent.name_for_emails.toLowerCase().replace(/\s+/g, '')}@example.com` 
          : null;

        return {
          fullName: agent.name,
          name: agent.name,
          email,
          phone: agent.phone || null,
          website: agent.site || null,
          profilePhotoSrc: agent.logo || null,
          profileLink: agent.site || null,
          company: extractCompanyName(agent.subtypes || agent.category || agent.type || ''),
          rating: agent.rating || 4.5,
          reviewCount: agent.reviews || 0,
          numTotalReviews: agent.reviews || 0,
          specialties: extractSpecialties(agent.subtypes || ''),
          address: agent.full_address || '',
          reviews: agent.reviews_data?.slice(0, 3).map((review: any) => ({
            text: review.review_text,
            rating: review.review_rating,
            author: review.author_title,
            date: review.review_datetime_utc,
          })) || [],
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

function extractCompanyName(subtypes: string): string {
  // Extract company name from subtypes string
  const types = subtypes.split(',').map(s => s.trim());
  for (const type of types) {
    if (type.toLowerCase().includes('agency') || 
        type.toLowerCase().includes('group') || 
        type.toLowerCase().includes('team') ||
        type.toLowerCase().includes('realty') ||
        type.toLowerCase().includes('properties')) {
      return type;
    }
  }
  return types[0] || 'Independent Agent';
}

function extractSpecialties(subtypes: string): string[] {
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
  const lowercaseSubtypes = subtypes.toLowerCase();

  for (const [key, value] of Object.entries(specialtyMap)) {
    if (lowercaseSubtypes.includes(key)) {
      specialties.push(value);
    }
  }

  return specialties.length > 0 ? specialties : ["Buyer's Agent", "Listing Agent"];
}

