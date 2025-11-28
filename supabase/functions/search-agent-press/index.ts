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
    const { agentName, city, state } = await req.json();
    
    if (!agentName) {
      return new Response(JSON.stringify({ error: 'Agent name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log(`🔍 Searching press mentions for: ${agentName} (${city}, ${state})`);

    // Craft a detailed prompt for Perplexity to find press mentions
    const searchPrompt = `Search the entire web for any news articles, press releases, interviews, or media coverage about real estate agent "${agentName}" who works in Arizona (Phoenix metro area, including ${city}, ${state}).

Include coverage from:
- National publications (Wall Street Journal, New York Times, Bloomberg, Reuters, etc.)
- Arizona/Phoenix regional news (Arizona Republic/azcentral.com, Phoenix Business Journal, etc.)
- Industry publications (Inman, RealTrends, HousingWire, National Association of Realtors)
- Local TV stations and newspapers (ABC15, Fox10, 12News, KTAR, etc.)
- Press releases and award announcements
- Business wire services and PR distribution platforms

Return ALL legitimate press mentions found from any credible news source. Do not limit search to specific domains.

IMPORTANT: Exclude these types of sites:
- Real estate listing sites (Zillow, Realtor.com, Redfin, Trulia, etc.)
- Social media posts (Facebook, LinkedIn, Instagram, Twitter/X)
- Brokerage profile pages
- Review sites (Yelp, Google reviews)

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "title": "Article title",
    "source": "domain.com",
    "url": "https://...",
    "snippet": "Brief excerpt from article",
    "date": "YYYY-MM-DD"
  }
]

If no press mentions found, return: []`;

    // Excluded domains (denylist mode)
    const excludedDomainsFilter = [
      '-zillow.com',
      '-realtor.com',
      '-redfin.com',
      '-trulia.com',
      '-homes.com',
      '-facebook.com',
      '-linkedin.com',
      '-instagram.com',
      '-twitter.com',
      '-x.com',
      '-yelp.com',
      '-compass.com',
      '-coldwellbanker.com',
      '-century21.com',
      '-remax.com',
      '-kw.com'
    ];

    // Call Perplexity AI
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant that finds press mentions and news articles. Always return valid JSON arrays only, with no markdown formatting or code blocks.'
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_domain_filter: excludedDomainsFilter
        // No recency filter - search all time for press mentions
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Perplexity API error:', response.status, errorText);
      
      // Return empty results instead of failing
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log(`📊 Perplexity response received`);
    console.log(`🔍 Full response:`, JSON.stringify(data, null, 2));

    // Extract the content from Perplexity's response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.log('ℹ️ No content in Perplexity response');
      return new Response(JSON.stringify({ mentions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📝 Raw content: ${content.substring(0, 500)}...`);

    // Parse the JSON response (handle markdown code blocks if present)
    let pressMentions = [];
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        // Extract JSON from markdown code block
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonStr = match[1].trim();
        }
      }

      pressMentions = JSON.parse(jsonStr);
      
      if (!Array.isArray(pressMentions)) {
        console.error('❌ Response is not an array');
        pressMentions = [];
      }
    } catch (parseError) {
      console.error('❌ Failed to parse Perplexity response as JSON:', parseError);
      console.error('Content was:', content);
      pressMentions = [];
    }

    // Additional filtering and validation
    const excludedDomains = [
      'zillow.com', 'realtor.com', 'facebook.com', 'linkedin.com', 
      'instagram.com', 'twitter.com', 'x.com', 'yelp.com', 'redfin.com',
      'homes.com', 'trulia.com', 'compass.com', 'coldwellbanker.com',
      'century21.com', 'remax.com', 'kw.com'
    ];

    const validatedMentions = pressMentions
      .filter((mention: any) => {
        // Must have required fields
        if (!mention.url || !mention.title) return false;
        
        // Check URL validity
        try {
          const url = new URL(mention.url);
          const hostname = url.hostname.toLowerCase();
          
          // Exclude unwanted domains
          if (excludedDomains.some(domain => hostname.includes(domain))) {
            return false;
          }
          
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, 5) // Limit to top 5
      .map((mention: any) => {
        try {
          const hostname = new URL(mention.url).hostname.replace('www.', '');
          return {
            title: mention.title,
            source: mention.source || hostname,
            url: mention.url,
            snippet: mention.snippet || '',
            date: mention.date || new Date().toISOString().split('T')[0]
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    console.log(`✅ Found ${validatedMentions.length} valid press mentions`);

    return new Response(JSON.stringify({ mentions: validatedMentions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in search-agent-press:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      mentions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
