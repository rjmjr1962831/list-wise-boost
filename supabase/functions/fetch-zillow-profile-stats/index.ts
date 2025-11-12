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
    
    console.log('Successfully fetched profile HTML, length:', html.length);
    
    // Parse stats from HTML - looking for Zillow's specific patterns
    const stats = {
      forSale: 0,
      sold: 0,
      forRent: 0,
      reviews: 0,
      currentListings: 0,
      totalSales: 0,
      yearsExperience: 0,
    };

    // Extract Zillow User ID (zuid) from profile URL or HTML
    let zuid = null;
    const zuidMatch = profileUrl.match(/profile\/([^\/]+)/);
    if (zuidMatch) {
      zuid = zuidMatch[1];
    }
    
    // Look for the stats tabs section - Zillow uses specific patterns
    // Pattern: "For Sale (39)" or "For Sale 39" or "39 For Sale"
    const forSaleMatch = html.match(/For\s+Sale[:\s]*\(?(\d+)\)?|(\d+)\s+For\s+Sale/i);
    if (forSaleMatch) {
      stats.forSale = parseInt(forSaleMatch[1] || forSaleMatch[2]);
      stats.currentListings = stats.forSale; // Also update currentListings
      console.log('Found For Sale:', stats.forSale);
    }
    
    // Pattern: "Sold (2279)" or "Sold: 2279"
    const soldMatch = html.match(/Sold[:\s]*\(?(\d+)\)?|(\d+)\s+Sold/i);
    if (soldMatch) {
      stats.sold = parseInt(soldMatch[1] || soldMatch[2]);
      stats.totalSales = stats.sold; // Also update totalSales
      console.log('Found Sold:', stats.sold);
    }
    
    // Pattern: "For Rent (2)" or "For Rent: 2"
    const forRentMatch = html.match(/For\s+Rent[:\s]*\(?(\d+)\)?|(\d+)\s+For\s+Rent/i);
    if (forRentMatch) {
      stats.forRent = parseInt(forRentMatch[1] || forRentMatch[2]);
      console.log('Found For Rent:', stats.forRent);
    }
    
    // Pattern: reviews count - look for various patterns
    const reviewPatterns = [
      /(\d+)\s+(?:reviews?|ratings?)/i,
      /reviews?[:\s]*\(?(\d+)\)?/i,
      /"reviewCount"[:\s]*(\d+)/i,
      /"ratingCount"[:\s]*(\d+)/i,
    ];
    
    for (const pattern of reviewPatterns) {
      const match = html.match(pattern);
      if (match) {
        const reviewCount = parseInt(match[1]);
        if (reviewCount > stats.reviews) {
          stats.reviews = reviewCount;
          console.log('Found reviews:', stats.reviews);
        }
      }
    }

    // Look for various patterns in the HTML for additional stats
    
    // Pattern 1: Total sales / transactions (fallback if "Sold" not found)
    if (stats.sold === 0) {
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
    }

    // Pattern 2: Years of experience
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
        zuid,
        stats,
        message: stats.sold > 0 || stats.forSale > 0 
          ? `Successfully extracted stats: ${stats.forSale} for sale, ${stats.sold} sold, ${stats.forRent} for rent, ${stats.reviews} reviews` 
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
