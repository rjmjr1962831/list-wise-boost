import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodInput {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { neighborhoodSlug, citySlug, stateSlug } = await req.json() as NeighborhoodInput;

    if (!neighborhoodSlug || !citySlug) {
      return new Response(
        JSON.stringify({ error: 'neighborhoodSlug and citySlug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch neighborhood data from catalog
    const { data: neighborhood, error: neighborhoodError } = await supabase
      .from('neighborhood_catalog')
      .select('*')
      .eq('neighborhood_slug', neighborhoodSlug)
      .eq('city_area_slug', citySlug)
      .eq('is_active', true)
      .maybeSingle();

    if (neighborhoodError) {
      console.error('[NeighborhoodWriteup] Error fetching neighborhood:', neighborhoodError);
      throw new Error('Failed to fetch neighborhood data');
    }

    if (!neighborhood) {
      return new Response(
        JSON.stringify({ error: 'Neighborhood not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NeighborhoodWriteup] Processing ${neighborhood.neighborhood}, ${neighborhood.city_area}, ${neighborhood.state}`);

    // Step 1: Use Gemini Flash to research the neighborhood
    const researchPrompt = `You are a real estate research assistant. Search for and compile comprehensive information about the ${neighborhood.neighborhood} neighborhood in ${neighborhood.city_area}, ${neighborhood.state}.

Include the following if available:
1. History and development of the neighborhood
2. Architectural styles and housing types
3. Notable landmarks, parks, and amenities
4. School districts and educational facilities
5. Shopping, dining, and entertainment options
6. Transportation and accessibility
7. Community culture and demographics
8. Real estate market trends and property values
9. Notable residents or cultural significance
10. Unique characteristics that make this neighborhood special

Additional context:
- Median home value: ${neighborhood.median_home_value ? `$${neighborhood.median_home_value.toLocaleString()}` : 'Not available'}
- Median income: ${neighborhood.median_income ? `$${neighborhood.median_income.toLocaleString()}` : 'Not available'}
- Tier: ${neighborhood.tier}
- ZIP codes: ${neighborhood.zips?.join(', ') || 'Not available'}

Provide detailed, factual information that would be helpful for someone considering buying or selling real estate in this neighborhood.`;

    console.log('[NeighborhoodWriteup] Calling Gemini Flash for research...');
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: researchPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[NeighborhoodWriteup] Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const researchContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!researchContent) {
      console.error('[NeighborhoodWriteup] No content from Gemini:', geminiData);
      throw new Error('No research content generated from Gemini');
    }

    console.log(`[NeighborhoodWriteup] Gemini research complete (${researchContent.length} chars)`);

    // Step 2: Use Claude Sonnet to craft the narrative
    const narrativePrompt = `You are a skilled real estate copywriter creating neighborhood profiles for Top10Lists.us, a merit-based real estate agent directory.

Based on the following research about ${neighborhood.neighborhood} in ${neighborhood.city_area}, ${neighborhood.state}, write an engaging, informative neighborhood overview.

RESEARCH DATA:
${researchContent}

ADDITIONAL DATA:
- Median Home Value: ${neighborhood.median_home_value ? `$${neighborhood.median_home_value.toLocaleString()}` : 'Data not available'}
- Median Household Income: ${neighborhood.median_income ? `$${neighborhood.median_income.toLocaleString()}` : 'Data not available'}
- Market Tier: ${neighborhood.tier}
- ZIP Codes Served: ${neighborhood.zips?.join(', ') || 'Not specified'}

REQUIREMENTS:
1. Write in a professional yet warm tone that appeals to homebuyers and sellers
2. Structure the content with clear sections using HTML formatting:
   - Use <h3> for section headers
   - Use <p> for paragraphs
   - Use <ul>/<li> for lists where appropriate
3. Include 4-6 sections covering: Overview, Lifestyle & Amenities, Real Estate Market, Schools & Education, and Why Choose This Neighborhood
4. Keep the total length between 600-900 words
5. Be factual and avoid superlatives that can't be verified
6. End with a call-to-action mentioning that top-rated agents specializing in this neighborhood are available on the page

Format the response as clean HTML that can be rendered directly on a webpage.`;

    console.log('[NeighborhoodWriteup] Calling Claude Sonnet for narrative...');

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: narrativePrompt }
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('[NeighborhoodWriteup] Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const narrativeContent = claudeData.content?.[0]?.text;

    if (!narrativeContent) {
      console.error('[NeighborhoodWriteup] No content from Claude:', claudeData);
      throw new Error('No narrative content generated from Claude');
    }

    console.log(`[NeighborhoodWriteup] Claude narrative complete (${narrativeContent.length} chars)`);

    // Save the writeup to the database
    const { error: updateError } = await supabase
      .from('neighborhood_catalog')
      .update({
        writeup_html: narrativeContent,
        writeup_research: researchContent,
        writeup_generated_at: new Date().toISOString(),
      })
      .eq('id', neighborhood.id);

    if (updateError) {
      console.error('[NeighborhoodWriteup] Failed to save writeup:', updateError);
    } else {
      console.log('[NeighborhoodWriteup] Writeup saved to database');
    }

    // Return the generated content
    return new Response(
      JSON.stringify({
        success: true,
        neighborhood: {
          name: neighborhood.neighborhood,
          city: neighborhood.city_area,
          state: neighborhood.state,
          slug: neighborhood.neighborhood_slug,
        },
        research: researchContent,
        narrative: narrativeContent,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NeighborhoodWriteup] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
