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

// Generate writeup using Gemini Flash only (for Main tier)
async function generateGeminiOnlyWriteup(
  neighborhood: NeighborhoodRecord,
  geminiApiKey: string
): Promise<{ research: string; narrative: string } | null> {
  const { neighborhood: name, city_area, state, tier, median_home_value, median_income } = neighborhood;
  
  const combinedPrompt = `Research and write about the ${name} neighborhood in ${city_area}, ${state}.

CONTEXT:
${median_home_value ? `Median Home Value: $${median_home_value.toLocaleString()}` : ''}
${median_income ? `Median Household Income: $${median_income.toLocaleString()}` : ''}
Market Tier: ${tier}

TASK:
1. First, research the neighborhood covering: location, history, housing types, demographics, amenities (schools, parks, shopping), real estate trends, unique features, landmarks, transportation, and community character.

2. Then, write an engaging HTML neighborhood overview for a real estate website.

REQUIREMENTS FOR THE WRITEUP:
- Write in a warm, professional tone that helps homebuyers envision living there
- Use HTML formatting with <h3>, <p>, and <ul>/<li> tags
- Include 4-6 sections covering: Overview, Lifestyle, Real Estate, Amenities, and Why Choose This Neighborhood
- Be factual but engaging
- Keep it 300-500 words
- Do NOT include <h1> or <h2> tags
- Do NOT wrap in <html>, <body>, or <div>

OUTPUT FORMAT:
First provide your research notes (plain text), then after "---WRITEUP---" provide the HTML content.`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: combinedPrompt }] }],
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
    const fullContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!fullContent) {
      console.error(`[Cron] No content for ${name}`);
      return null;
    }

    // Split into research and writeup
    const parts = fullContent.split('---WRITEUP---');
    const research = parts[0]?.trim() || fullContent;
    const narrative = parts[1]?.trim() || fullContent;

    return { research, narrative };
  } catch (error) {
    console.error(`[Cron] Error processing ${name}:`, error);
    return null;
  }
}

// Generate writeup using Gemini research + DeepSeek narrative (for Premium/Luxury tiers)
async function generatePremiumWriteup(
  neighborhood: NeighborhoodRecord,
  geminiApiKey: string,
  _anthropicApiKey: string
): Promise<{ research: string; narrative: string } | null> {
  const { neighborhood: name, city_area, state, tier, median_home_value, median_income } = neighborhood;

  const researchPrompt = `Research the ${name} neighborhood in ${city_area}, ${state}.
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

    const narrativePrompt = `You are writing a neighborhood overview for a real estate website. Based on the research below, create an engaging, informative HTML narrative about the ${name} neighborhood in ${city_area}, ${state}.

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

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekApiKey) {
      console.error(`[Cron] DEEPSEEK_API_KEY not set, falling back to Gemini-only for ${name}`);
      return generateGeminiOnlyWriteup(neighborhood, geminiApiKey);
    }

    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 2048,
        messages: [{ role: 'user', content: narrativePrompt }],
      }),
    });

    if (!deepseekResponse.ok) {
      console.error(`[Cron] DeepSeek error for ${name}: ${deepseekResponse.status}`);
      return null;
    }

    const deepseekData = await deepseekResponse.json();
    const narrativeContent = deepseekData.choices?.[0]?.message?.content;

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

// Route to appropriate enrichment based on tier
// All tiers now use Gemini research + DeepSeek narrative (cost: ~$0.001/neighborhood)
async function generateWriteup(
  neighborhood: NeighborhoodRecord,
  geminiApiKey: string,
  anthropicApiKey: string
): Promise<{ research: string; narrative: string } | null> {
  const tier = neighborhood.tier?.toLowerCase() || 'main';

  // Prime and Luxury tiers get Gemini research + DeepSeek narrative
  if (tier === 'prime' || tier === 'luxury') {
    console.log(`[Cron] Using Gemini+DeepSeek for ${neighborhood.neighborhood} (${tier} tier)`);
    return generatePremiumWriteup(neighborhood, geminiApiKey, anthropicApiKey);
  }

  // Main tier uses Gemini-only (combined research + writeup)
  console.log(`[Cron] Using Gemini-only for ${neighborhood.neighborhood} (${tier} tier)`);
  return generateGeminiOnlyWriteup(neighborhood, geminiApiKey);
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
  const BATCH_SIZE = 15; // Reduced to avoid rate limits
  const CONCURRENCY = 3; // Lower concurrency to stay under Gemini rate limits

  // Get neighborhoods without writeups from AZ and CA
  const { data: neighborhoods, error: fetchError } = await supabase
    .from('neighborhood_catalog')
    .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, median_home_value, median_income')
    .in('state', ['Arizona', 'California', 'Texas'])
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

    // Longer delay between chunks to avoid Gemini rate limits
    if (i + CONCURRENCY < neighborhoods.length) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`[Cron] Batch complete: ${successful} success, ${failed} failed`);
}

Deno.serve(async (req) => {
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
