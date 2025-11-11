import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProfileStatsRequest {
  profileUrl: string;
  agentName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl, agentName }: ProfileStatsRequest = await req.json();
    
    console.log(`Fetching detailed stats for ${agentName} from ${profileUrl}`);

    // Construct full Zillow URL if relative
    const fullUrl = profileUrl.startsWith('http') 
      ? profileUrl 
      : `https://www.zillow.com${profileUrl}`;

    // Fetch the profile page
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const html = await response.text();
    
    console.log('Successfully fetched profile HTML');
    
    // Parse stats from HTML
    const stats = {
      totalSales: 0,
      salesLast12Months: 0,
      currentListings: 0,
      yearsExperience: 0,
      avgSalePrice: 0,
    };

    // Look for various patterns in the HTML
    
    // Pattern 1: Total sales / transactions
    const salesPatterns = [
      /(\d+)\s+(?:sales?|transactions?|deals?)\s+(?:in\s+career|total|all[\s-]?time)/gi,
      /(?:career|total|all[\s-]?time)\s+(?:sales?|transactions?):\s*(\d+)/gi,
      /(\d+)\s+homes?\s+sold/gi,
    ];
    
    for (const pattern of salesPatterns) {
      const match = html.match(pattern);
      if (match) {
        const numbers = match.map(m => {
          const num = m.match(/\d+/);
          return num ? parseInt(num[0]) : 0;
        });
        stats.totalSales = Math.max(stats.totalSales, ...numbers);
      }
    }

    // Pattern 2: Sales last 12 months
    const last12MonthsPatterns = [
      /(\d+)\s+(?:sales?|transactions?)\s+(?:in\s+)?(?:the\s+)?(?:last|past)\s+(?:12\s+months?|year)/gi,
      /(?:last|past)\s+(?:12\s+months?|year):\s*(\d+)\s+(?:sales?|transactions?)/gi,
    ];
    
    for (const pattern of last12MonthsPatterns) {
      const match = html.match(pattern);
      if (match) {
        const numbers = match.map(m => {
          const num = m.match(/\d+/);
          return num ? parseInt(num[0]) : 0;
        });
        stats.salesLast12Months = Math.max(stats.salesLast12Months, ...numbers);
      }
    }

    // Pattern 3: Current listings / active listings
    const listingsPatterns = [
      /(\d+)\s+(?:current|active)\s+listings?/gi,
      /(?:current|active)\s+listings?:\s*(\d+)/gi,
      /(\d+)\s+properties?\s+(?:for\s+sale|listed)/gi,
    ];
    
    for (const pattern of listingsPatterns) {
      const match = html.match(pattern);
      if (match) {
        const numbers = match.map(m => {
          const num = m.match(/\d+/);
          return num ? parseInt(num[0]) : 0;
        });
        stats.currentListings = Math.max(stats.currentListings, ...numbers);
      }
    }

    // Pattern 4: Years of experience
    const experiencePatterns = [
      /(\d+)\+?\s+years?\s+(?:of\s+)?experience/gi,
      /experience:\s*(\d+)\+?\s+years?/gi,
      /licensed\s+(?:for|since)\s+(\d+)\s+years?/gi,
    ];
    
    for (const pattern of experiencePatterns) {
      const match = html.match(pattern);
      if (match) {
        const numbers = match.map(m => {
          const num = m.match(/\d+/);
          return num ? parseInt(num[0]) : 0;
        });
        stats.yearsExperience = Math.max(stats.yearsExperience, ...numbers);
      }
    }

    // Pattern 5: Average sale price
    const avgPricePatterns = [
      /(?:average|avg\.?|median)\s+(?:sale|sold)\s+price:\s*\$?([\d,]+)k?/gi,
      /\$?([\d,]+)k?\s+(?:average|avg\.?|median)\s+(?:sale|sold)\s+price/gi,
    ];
    
    for (const pattern of avgPricePatterns) {
      const match = html.match(pattern);
      if (match) {
        const priceStr = match[0].replace(/[^\d,]/g, '');
        const price = parseInt(priceStr.replace(/,/g, ''));
        if (price > 0) {
          stats.avgSalePrice = price;
          // If it looks like it's in thousands (e.g., "450k"), multiply
          if (match[0].toLowerCase().includes('k') && price < 10000) {
            stats.avgSalePrice = price * 1000;
          }
        }
      }
    }

    // If we didn't find explicit sales numbers, try to find structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        console.log('Found structured data:', JSON.stringify(jsonData).substring(0, 200));
        
        // Look for relevant properties in structured data
        if (jsonData.numberOfListings) {
          stats.currentListings = Math.max(stats.currentListings, jsonData.numberOfListings);
        }
        if (jsonData.numberOfSales) {
          stats.totalSales = Math.max(stats.totalSales, jsonData.numberOfSales);
        }
      } catch (e) {
        console.log('Could not parse structured data');
      }
    }

    console.log('Extracted stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        agentName,
        profileUrl: fullUrl,
        stats,
        message: stats.totalSales > 0 || stats.currentListings > 0 
          ? 'Successfully extracted stats from profile' 
          : 'Profile fetched but no stats found - will use estimates',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-zillow-profile-stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: null,
      }),
      {
        status: 200, // Return 200 to not break import flow
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
