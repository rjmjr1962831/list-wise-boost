import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodResult {
  name: string;
  slug: string;
  city: string;
  zipCodes: string[];
  primaryZip: string;
  description: string;
  vibe: string;
}

interface CityResult {
  city: string;
  neighborhoods: NeighborhoodResult[];
  model: string;
  processingTimeMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const { cities = ["San Diego", "Oakland", "Anaheim"] } = await req.json();
    
    console.log(`Starting DeepSeek neighborhood discovery for ${cities.length} cities:`, cities);

    const results: CityResult[] = [];
    const overallStart = Date.now();

    for (const cityName of cities) {
      const cityStart = Date.now();
      console.log(`\n--- Processing: ${cityName}, California ---`);

      const prompt = `You are a California real estate expert with deep knowledge of local neighborhoods.

List ALL distinct, locally-recognized neighborhoods in ${cityName}, California.

IMPORTANT REQUIREMENTS:
1. Include ONLY neighborhoods that are WITHIN the city limits of ${cityName}
2. Include well-known neighborhoods, historic districts, and commonly-used local names
3. Do NOT include adjacent cities or suburbs - only neighborhoods within ${cityName}
4. For each neighborhood, provide accurate ZIP code(s) that cover that area

For each neighborhood provide:
- name: Official or commonly used name
- slug: URL-safe lowercase-hyphenated version (e.g., "la-jolla", "pacific-beach")
- city: "${cityName}" (the city this neighborhood belongs to)
- zipCodes: Array of ZIP codes covering this neighborhood
- primaryZip: Main/primary ZIP code for the neighborhood center
- description: 1-2 sentence description of the area
- vibe: One phrase describing neighborhood character (e.g., "Upscale coastal living")

Return ONLY a valid JSON array. No markdown, no explanation, just the JSON array.
For small cities with no distinct neighborhoods, return an empty array [].

Example format:
[
  {
    "name": "La Jolla",
    "slug": "la-jolla",
    "city": "San Diego",
    "zipCodes": ["92037", "92038"],
    "primaryZip": "92037",
    "description": "Upscale coastal community known for beautiful beaches, caves, and UCSD.",
    "vibe": "Affluent seaside resort"
  }
]`;

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 8192,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`DeepSeek API error for ${cityName}:`, response.status, errorText);
          results.push({
            city: cityName,
            neighborhoods: [],
            model: 'deepseek-chat',
            processingTimeMs: Date.now() - cityStart,
          });
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';
        
        // Extract token usage
        const tokenUsage = data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined;

        // Parse the JSON response
        let neighborhoods: NeighborhoodResult[] = [];
        try {
          // Clean up the response - remove markdown code blocks if present
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.slice(7);
          }
          if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.slice(3);
          }
          if (cleanContent.endsWith('```')) {
            cleanContent = cleanContent.slice(0, -3);
          }
          cleanContent = cleanContent.trim();

          neighborhoods = JSON.parse(cleanContent);
          
          // Validate the structure
          if (!Array.isArray(neighborhoods)) {
            console.error(`Invalid response structure for ${cityName}: not an array`);
            neighborhoods = [];
          }
        } catch (parseError) {
          console.error(`JSON parse error for ${cityName}:`, parseError);
          console.error('Raw content:', content.substring(0, 500));
          neighborhoods = [];
        }

        const processingTimeMs = Date.now() - cityStart;
        console.log(`${cityName}: Found ${neighborhoods.length} neighborhoods in ${processingTimeMs}ms`);
        if (tokenUsage) {
          console.log(`  Tokens - Prompt: ${tokenUsage.promptTokens}, Completion: ${tokenUsage.completionTokens}, Total: ${tokenUsage.totalTokens}`);
        }

        results.push({
          city: cityName,
          neighborhoods,
          model: 'deepseek-chat',
          processingTimeMs,
          tokenUsage,
        });

      } catch (cityError) {
        console.error(`Error processing ${cityName}:`, cityError);
        results.push({
          city: cityName,
          neighborhoods: [],
          model: 'deepseek-chat',
          processingTimeMs: Date.now() - cityStart,
        });
      }

      // Small delay between cities to avoid rate limiting
      if (cities.indexOf(cityName) < cities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const totalTimeMs = Date.now() - overallStart;
    const totalNeighborhoods = results.reduce((sum, r) => sum + r.neighborhoods.length, 0);
    const totalTokens = results.reduce((sum, r) => sum + (r.tokenUsage?.totalTokens || 0), 0);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total cities processed: ${results.length}`);
    console.log(`Total neighborhoods discovered: ${totalNeighborhoods}`);
    console.log(`Total processing time: ${totalTimeMs}ms`);
    console.log(`Total tokens used: ${totalTokens}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        citiesProcessed: results.length,
        totalNeighborhoods,
        totalTimeMs,
        totalTokens,
        avgNeighborhoodsPerCity: (totalNeighborhoods / results.length).toFixed(1),
      },
      results,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('discover-neighborhoods-deepseek error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
