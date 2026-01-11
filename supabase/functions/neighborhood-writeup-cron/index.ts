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
      console.error(`[Cron] Gemini error for ${name}: ${geminiResponse.status}`);
      return null;
    }

    const geminiData = await geminiResponse.json();
    const researchContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!researchContent) {
      console.error(`[Cron] No research content for ${name}`);
      return null;
    }

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
      console.error(`[Cron] Claude error for ${name}: ${claudeResponse.status}`);
      return null;
    }

    const claudeData = await claudeResponse.json();
    const narrativeContent = claudeData.content?.[0]?.text;
    
    if (!narrativeContent) {
      console.error(`[Cron] No narrative content for ${name}`);
      return null;
    }

    return { research: researchContent, narrative: narrativeContent };
  } catch (error) {
    console.error(`[Cron] Error processing ${name}:`, error);
    return null;
  }
}

async function processNeighborhoods() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!geminiApiKey || !anthropicApiKey) {
    console.error('[Cron] Missing API keys');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const BATCH_SIZE = 30; // Fetch more to process concurrently
  const CONCURRENCY = 10;

  // Get neighborhoods without writeups
  const { data: neighborhoods, error: fetchError } = await supabase
    .from('neighborhood_catalog')
    .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, median_home_value, median_income')
    .eq('state', 'AZ')
    .is('writeup_html', null)
    .eq('is_active', true)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(BATCH_SIZE);

  if (fetchError || !neighborhoods || neighborhoods.length === 0) {
    console.log('[Cron] No more neighborhoods to process or error:', fetchError?.message);
    return;
  }

  console.log(`[Cron] Processing ${neighborhoods.length} neighborhoods with ${CONCURRENCY} concurrency...`);

  let successful = 0;
  let failed = 0;

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < neighborhoods.length; i += CONCURRENCY) {
    const chunk = neighborhoods.slice(i, i + CONCURRENCY);
    console.log(`[Cron] Processing chunk ${Math.floor(i / CONCURRENCY) + 1}: ${chunk.map(n => n.neighborhood).join(', ')}`);
    
    const results = await Promise.allSettled(
      chunk.map(async (neighborhood) => {
        console.log(`[Cron] Starting: ${neighborhood.neighborhood}, ${neighborhood.city_area}`);
        
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
            console.error(`[Cron] Failed to save ${neighborhood.neighborhood}:`, updateError);
            throw new Error(`Save failed: ${updateError.message}`);
          }
          
          console.log(`[Cron] ✓ Saved: ${neighborhood.neighborhood}`);
          return neighborhood.neighborhood;
        } else {
          throw new Error(`Generation failed for ${neighborhood.neighborhood}`);
        }
      })
    );

    // Count results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successful++;
      } else {
        failed++;
        console.error(`[Cron] Failed:`, result.reason);
      }
    }

    // Small delay between chunks to avoid rate limits
    if (i + CONCURRENCY < neighborhoods.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`[Cron] Batch complete: ${successful} success, ${failed} failed`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Use EdgeRuntime.waitUntil for background processing
  // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(processNeighborhoods());
    
    return new Response(
      JSON.stringify({ 
        message: 'Background processing started',
        status: 'running'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fallback for testing - run synchronously
  await processNeighborhoods();
  
  return new Response(
    JSON.stringify({ message: 'Processing complete' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
