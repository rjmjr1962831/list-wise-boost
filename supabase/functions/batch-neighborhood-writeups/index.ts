import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodRecord {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  tier: string;
  median_home_value: number | null;
  median_income: number | null;
}

// Generate writeup for a single neighborhood
async function generateWriteup(
  neighborhood: NeighborhoodRecord,
  geminiApiKey: string,
  anthropicApiKey: string
): Promise<{ research: string; narrative: string } | null> {
  const { neighborhood: name, city_area, state, tier, median_home_value, median_income } = neighborhood;
  
  // Step 1: Gemini research
  const researchPrompt = `Research the ${name} neighborhood in ${city_area}, ${state === 'AZ' ? 'Arizona' : state}. 
Include:
1. Geographic location and boundaries
2. History and development
3. Housing types and architecture styles
4. Demographics and community character
5. Local amenities (schools, parks, shopping, dining)
6. Real estate market trends
7. What makes this neighborhood unique
8. Notable landmarks or attractions
9. Transportation and accessibility
10. Lifestyle and community events

${median_home_value ? `Median Home Value: $${median_home_value.toLocaleString()}` : ''}
${median_income ? `Median Household Income: $${median_income.toLocaleString()}` : ''}
Market Tier: ${tier}

Provide comprehensive, factual information.`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
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
      console.error(`[Batch] Gemini error for ${name}: ${geminiResponse.status}`);
      return null;
    }

    const geminiData = await geminiResponse.json();
    const researchContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!researchContent) {
      console.error(`[Batch] No research content for ${name}`);
      return null;
    }

    // Step 2: Claude narrative
    const narrativePrompt = `You are writing a neighborhood overview for a real estate website. Based on the research below, create an engaging, informative HTML narrative about the ${name} neighborhood in ${city_area}, ${state === 'AZ' ? 'Arizona' : state}.

RESEARCH:
${researchContent}

REQUIREMENTS:
1. Write in a warm, professional tone that helps homebuyers envision living there
2. Use HTML formatting with <h3>, <p>, and <ul>/<li> tags
3. Include 4-6 sections covering: Overview, Lifestyle, Real Estate, Amenities, and Why Choose This Neighborhood
4. Be factual but engaging
5. Keep it 400-600 words
6. Do NOT include <h1> or <h2> tags (the page already has those)
7. Do NOT wrap in <html>, <body>, or <div> - just the content sections

OUTPUT FORMAT:
<h3>Section Title</h3>
<p>Content...</p>`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: narrativePrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      console.error(`[Batch] Claude error for ${name}: ${claudeResponse.status}`);
      return null;
    }

    const claudeData = await claudeResponse.json();
    const narrativeContent = claudeData.content?.[0]?.text;
    
    if (!narrativeContent) {
      console.error(`[Batch] No narrative content for ${name}`);
      return null;
    }

    return { research: researchContent, narrative: narrativeContent };
  } catch (error) {
    console.error(`[Batch] Error processing ${name}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 10, startFrom = 0, dryRun = false } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!geminiApiKey || !anthropicApiKey) {
      throw new Error('Missing API keys: GEMINI_API_KEY or ANTHROPIC_API_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get neighborhoods without writeups
    const { data: neighborhoods, error: fetchError } = await supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, median_home_value, median_income')
      .in('state', ['Arizona', 'California', 'Texas'])
      .is('writeup_html', null)
      .eq('is_active', true)
      .order('score', { ascending: false, nullsFirst: false })
      .range(startFrom, startFrom + batchSize - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch neighborhoods: ${fetchError.message}`);
    }

    if (!neighborhoods || neighborhoods.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No more neighborhoods to process',
          processed: 0,
          startFrom,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total count for progress
    const { count: totalRemaining } = await supabase
      .from('neighborhood_catalog')
      .select('*', { count: 'exact', head: true })
      .in('state', ['Arizona', 'California', 'Texas'])
      .is('writeup_html', null)
      .eq('is_active', true);

    console.log(`[Batch] Processing ${neighborhoods.length} neighborhoods (${totalRemaining} remaining without writeups)`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          wouldProcess: neighborhoods.map(n => `${n.neighborhood}, ${n.city_area}`),
          totalRemaining,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { neighborhood: string; city: string; success: boolean; error?: string }[] = [];

    // Process neighborhoods sequentially to avoid rate limits
    for (const neighborhood of neighborhoods) {
      console.log(`[Batch] Processing: ${neighborhood.neighborhood}, ${neighborhood.city_area}`);
      
      const writeup = await generateWriteup(neighborhood, geminiApiKey, anthropicApiKey);
      
      if (writeup) {
        const { error: updateError } = await supabase
          .from('neighborhood_catalog')
          .update({
            writeup_html: writeup.narrative,
            writeup_research: writeup.research,
            writeup_generated_at: new Date().toISOString(),
          })
          .eq('id', neighborhood.id);

        if (updateError) {
          console.error(`[Batch] Failed to save ${neighborhood.neighborhood}:`, updateError);
          results.push({ 
            neighborhood: neighborhood.neighborhood, 
            city: neighborhood.city_area, 
            success: false, 
            error: updateError.message 
          });
        } else {
          console.log(`[Batch] Saved: ${neighborhood.neighborhood}`);
          results.push({ 
            neighborhood: neighborhood.neighborhood, 
            city: neighborhood.city_area, 
            success: true 
          });
        }
      } else {
        results.push({ 
          neighborhood: neighborhood.neighborhood, 
          city: neighborhood.city_area, 
          success: false, 
          error: 'Failed to generate writeup' 
        });
      }

      // Rate limiting: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${neighborhoods.length} neighborhoods`,
        successful,
        failed,
        totalRemaining: (totalRemaining || 0) - successful,
        nextStartFrom: startFrom + batchSize,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Batch] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
