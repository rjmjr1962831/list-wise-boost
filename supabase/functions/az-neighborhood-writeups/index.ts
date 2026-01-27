import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 25;
const GEMINI_DELAY_MS = 500;
const CLAUDE_DELAY_MS = 1000;

interface Neighborhood {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  primary_zip: string | null;
  lat: number | null;
  lon: number | null;
  median_income: number | null;
  median_home_value: number | null;
  tier: string;
  nearby_neighborhoods: any;
}

interface PipelineState {
  processed: number;
  remaining: number;
  errors: number;
  last_neighborhood: string | null;
  started_at: string;
  last_update: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getGeminiResearch(neighborhood: Neighborhood, apiKey: string): Promise<string> {
  const prompt = `Research the neighborhood "${neighborhood.neighborhood}" in ${neighborhood.city_area}, Arizona (ZIP: ${neighborhood.primary_zip || 'unknown'}).

Provide factual information about:
1. Location and geography within the city
2. Types of housing available (single-family, condos, townhomes, etc.)
3. Key amenities (shopping, dining, parks, recreation)
4. Notable features or landmarks
5. Demographics and community character
6. School district (if known)
7. Transportation access (highways, public transit)

Be concise and factual. Do not make up information if uncertain.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        })
      }
    );

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return '';
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error(`Gemini research error for ${neighborhood.neighborhood}:`, error);
    return '';
  }
}

async function generateClaudeWriteup(neighborhood: Neighborhood, research: string, apiKey: string): Promise<string> {
  const nearbyText = neighborhood.nearby_neighborhoods 
    ? (Array.isArray(neighborhood.nearby_neighborhoods) 
        ? neighborhood.nearby_neighborhoods.slice(0, 3).join(', ')
        : typeof neighborhood.nearby_neighborhoods === 'object'
          ? Object.values(neighborhood.nearby_neighborhoods).slice(0, 3).join(', ')
          : 'various neighborhoods')
    : 'surrounding areas';

  const prompt = `Write a neighborhood description for a real estate directory.

NEIGHBORHOOD: ${neighborhood.neighborhood}
CITY: ${neighborhood.city_area}, Arizona
ZIP: ${neighborhood.primary_zip || 'N/A'}
TIER: ${neighborhood.tier}
MEDIAN INCOME: ${neighborhood.median_income ? `$${neighborhood.median_income.toLocaleString()}` : 'Data not available'}
MEDIAN HOME VALUE: ${neighborhood.median_home_value ? `$${neighborhood.median_home_value.toLocaleString()}` : 'Data not available'}
NEARBY: ${nearbyText}

RESEARCH:
${research || 'Limited research available. Focus on general Arizona neighborhood characteristics.'}

RULES:
1. Write 2-3 paragraphs (300-400 words) in HTML format
2. Use <h3> headers: "Neighborhood Overview", "Housing & Market", "Lifestyle & Amenities"
3. Wrap paragraphs in <p> tags
4. Incorporate income/home value naturally if available
5. Keep factual, not salesy
6. Do NOT use em dashes. Use proper sentence structure.
7. Reference nearby neighborhoods for context when relevant

Return only HTML, starting with <h3>, ending with </p>.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API error: ${response.status} - ${errorText}`);
      return '';
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Clean up the response - ensure it starts with <h3> and ends with </p>
    let cleaned = content.trim();
    if (!cleaned.startsWith('<h3>')) {
      const h3Index = cleaned.indexOf('<h3>');
      if (h3Index > -1) {
        cleaned = cleaned.substring(h3Index);
      }
    }
    
    return cleaned;
  } catch (error) {
    console.error(`Claude writeup error for ${neighborhood.neighborhood}:`, error);
    return '';
  }
}

async function updateNeighborhood(
  id: string, 
  writeupHtml: string, 
  enrichmentApiKey: string,
  supabaseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/enrichment-api?action=update-neighborhood`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enrichment-Key': enrichmentApiKey
        },
        body: JSON.stringify({
          id,
          writeup_html: writeupHtml,
          writeup_generated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Update failed for ${id}: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Update error for ${id}:`, error);
    return false;
  }
}

async function fetchNeighborhoodsNeedingWriteups(
  enrichmentApiKey: string,
  supabaseUrl: string,
  limit: number = BATCH_SIZE
): Promise<Neighborhood[]> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/enrichment-api?action=query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enrichment-Key': enrichmentApiKey
        },
        body: JSON.stringify({
          table: 'neighborhood_catalog',
          select: 'id,neighborhood,neighborhood_slug,city_area,city_area_slug,primary_zip,lat,lon,median_income,median_home_value,tier,nearby_neighborhoods',
          filters: [
            { field: 'state', operator: 'eq', value: 'Arizona' },
            { field: 'writeup_html', operator: 'is', value: 'null' }
          ],
          limit,
          offset: 0
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Query failed: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Fetch neighborhoods error:', error);
    return [];
  }
}

async function countRemainingNeighborhoods(
  enrichmentApiKey: string,
  supabaseUrl: string
): Promise<number> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/enrichment-api?action=query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enrichment-Key': enrichmentApiKey
        },
        body: JSON.stringify({
          table: 'neighborhood_catalog',
          select: 'id',
          filters: [
            { field: 'state', operator: 'eq', value: 'Arizona' },
            { field: 'writeup_html', operator: 'is', value: 'null' }
          ],
          limit: 5000,
          offset: 0
        })
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.data?.length || 0;
  } catch (error) {
    console.error('Count error:', error);
    return 0;
  }
}

async function logAlert(
  supabase: any,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error',
  metadata: any = null
) {
  try {
    await supabase.from('pipeline_alerts').insert({
      pipeline: 'az_neighborhood_writeups',
      title,
      message,
      severity,
      metadata
    });
  } catch (error) {
    console.error('Failed to log alert:', error);
  }
}

async function updateState(supabase: any, state: PipelineState, status: string) {
  try {
    await supabase
      .from('cron_state')
      .upsert({
        job_name: 'az_neighborhood_writeups',
        status,
        message: JSON.stringify(state),
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_name' });
  } catch (error) {
    console.error('Failed to update state:', error);
  }
}

async function getState(supabase: any): Promise<{ status: string; state: PipelineState | null }> {
  try {
    const { data } = await supabase
      .from('cron_state')
      .select('status, message')
      .eq('job_name', 'az_neighborhood_writeups')
      .single();
    
    if (data) {
      return {
        status: data.status || 'idle',
        state: data.message ? JSON.parse(data.message) : null
      };
    }
  } catch (error) {
    // No existing state
  }
  
  return { status: 'idle', state: null };
}

async function selfTrigger(supabaseUrl: string, anonKey: string) {
  try {
    await fetch(
      `${supabaseUrl}/functions/v1/az-neighborhood-writeups`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ action: 'continue' })
      }
    );
  } catch (error) {
    console.error('Self-trigger failed:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const enrichmentApiKey = Deno.env.get('ENRICHMENT_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action = 'status' } = await req.json().catch(() => ({}));

    console.log(`[az-neighborhood-writeups] Action: ${action}`);

    // Handle status request
    if (action === 'status') {
      const { status, state } = await getState(supabase);
      const currentRemaining = await countRemainingNeighborhoods(enrichmentApiKey, supabaseUrl);
      
      return new Response(
        JSON.stringify({
          success: true,
          status,
          state,
          current_remaining: currentRemaining
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle stop request
    if (action === 'stop') {
      const { state } = await getState(supabase);
      if (state) {
        state.last_update = new Date().toISOString();
        await updateState(supabase, state, 'stopped');
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Pipeline stopped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle start request
    if (action === 'start') {
      // Fresh count from database
      const totalRemaining = await countRemainingNeighborhoods(enrichmentApiKey, supabaseUrl);
      
      const newState: PipelineState = {
        processed: 0,
        remaining: totalRemaining,
        errors: 0,
        last_neighborhood: null,
        started_at: new Date().toISOString(),
        last_update: new Date().toISOString()
      };
      
      await updateState(supabase, newState, 'running');
      await logAlert(supabase, 'Pipeline Started', `Starting AZ neighborhood writeup generation. ${totalRemaining} neighborhoods to process.`, 'info');
      
      // Continue to processing
    }

    // Check if we should stop
    const { status } = await getState(supabase);
    if (status === 'stopped') {
      return new Response(
        JSON.stringify({ success: true, message: 'Pipeline is stopped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch batch of neighborhoods
    const neighborhoods = await fetchNeighborhoodsNeedingWriteups(enrichmentApiKey, supabaseUrl);
    
    if (neighborhoods.length === 0) {
      const { state } = await getState(supabase);
      if (state) {
        state.remaining = 0;
        state.last_update = new Date().toISOString();
        await updateState(supabase, state, 'completed');
      }
      await logAlert(supabase, 'Pipeline Completed', `AZ neighborhood writeup generation complete. Processed: ${state?.processed || 0}`, 'info');
      
      return new Response(
        JSON.stringify({ success: true, message: 'All neighborhoods processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[az-neighborhood-writeups] Processing ${neighborhoods.length} neighborhoods`);

    let batchProcessed = 0;
    let batchErrors = 0;

    for (const neighborhood of neighborhoods) {
      try {
        console.log(`[az-neighborhood-writeups] Processing: ${neighborhood.neighborhood}`);
        
        // Gemini research
        await sleep(GEMINI_DELAY_MS);
        const research = await getGeminiResearch(neighborhood, geminiApiKey);
        
        // Claude writeup
        await sleep(CLAUDE_DELAY_MS);
        const writeup = await generateClaudeWriteup(neighborhood, research, anthropicApiKey);
        
        if (!writeup) {
          console.error(`[az-neighborhood-writeups] No writeup generated for ${neighborhood.neighborhood}`);
          batchErrors++;
          await logAlert(supabase, 'Writeup Generation Failed', `Failed to generate writeup for ${neighborhood.neighborhood}`, 'warning', { neighborhood_id: neighborhood.id });
          continue;
        }
        
        // Update neighborhood
        const updated = await updateNeighborhood(neighborhood.id, writeup, enrichmentApiKey, supabaseUrl);
        
        if (updated) {
          batchProcessed++;
          console.log(`[az-neighborhood-writeups] ✓ Updated: ${neighborhood.neighborhood}`);
        } else {
          batchErrors++;
          await logAlert(supabase, 'Update Failed', `Failed to update ${neighborhood.neighborhood}`, 'warning', { neighborhood_id: neighborhood.id });
        }
      } catch (error) {
        console.error(`[az-neighborhood-writeups] Error processing ${neighborhood.neighborhood}:`, error);
        batchErrors++;
        await logAlert(supabase, 'Processing Error', `Error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error', { neighborhood_id: neighborhood.id });
      }
    }

    // Update state
    const { state: currentState } = await getState(supabase);
    const newRemaining = await countRemainingNeighborhoods(enrichmentApiKey, supabaseUrl);
    
    const updatedState: PipelineState = {
      processed: (currentState?.processed || 0) + batchProcessed,
      remaining: newRemaining,
      errors: (currentState?.errors || 0) + batchErrors,
      last_neighborhood: neighborhoods[neighborhoods.length - 1]?.neighborhood || null,
      started_at: currentState?.started_at || new Date().toISOString(),
      last_update: new Date().toISOString()
    };
    
    await updateState(supabase, updatedState, newRemaining > 0 ? 'running' : 'completed');
    
    console.log(`[az-neighborhood-writeups] Batch complete. Processed: ${batchProcessed}, Errors: ${batchErrors}, Remaining: ${newRemaining}`);

    // Self-trigger if more remain
    if (newRemaining > 0) {
      console.log('[az-neighborhood-writeups] Self-triggering next batch...');
      await selfTrigger(supabaseUrl, supabaseAnonKey);
    } else {
      await logAlert(supabase, 'Pipeline Completed', `All AZ neighborhoods processed. Total: ${updatedState.processed}, Errors: ${updatedState.errors}`, 'info');
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_processed: batchProcessed,
        batch_errors: batchErrors,
        total_processed: updatedState.processed,
        remaining: newRemaining
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[az-neighborhood-writeups] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
