import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodData {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  primary_zip: string;
  state: string;
  tier: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { limit = 5, dryRun = false } = await req.json().catch(() => ({}));

    // Find neighborhoods with placeholder data
    const { data: neighborhoods, error: fetchError } = await supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, primary_zip, state, tier, zips')
      .eq('is_active', true)
      .eq('median_home_value', -666666666)
      .not('primary_zip', 'is', null)
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch neighborhoods: ${fetchError.message}`);
    }

    if (!neighborhoods || neighborhoods.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No neighborhoods with placeholder data found",
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${neighborhoods.length} neighborhoods to enrich`);

    const results: Array<{ id: string; neighborhood: string; success: boolean; error?: string }> = [];

    for (const hood of neighborhoods) {
      console.log(`Enriching: ${hood.neighborhood}, ${hood.city_area}, ${hood.state}`);

      try {
        // Call Lovable AI to get neighborhood data
        const prompt = `You are a real estate data analyst. Provide accurate market data for this Arizona neighborhood.

Neighborhood: ${hood.neighborhood}
City: ${hood.city_area}
State: Arizona
ZIP Code: ${hood.primary_zip}
${hood.zips ? `Other ZIP codes: ${hood.zips.join(', ')}` : ''}

Research this specific neighborhood and provide:
1. Estimated median home value (realistic for this Arizona area - typically $200,000 to $800,000 range)
2. Estimated median household income (realistic - typically $40,000 to $120,000 range)
3. A brief neighborhood writeup (2-3 paragraphs) describing:
   - Location and character of the neighborhood
   - Housing types and real estate market
   - Nearby amenities and lifestyle

Be specific to this exact neighborhood. If you're unsure, provide reasonable estimates based on the city and ZIP code.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "user", content: prompt }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "provide_neighborhood_data",
                  description: "Provide real estate market data for a neighborhood",
                  parameters: {
                    type: "object",
                    properties: {
                      median_home_value: { 
                        type: "number", 
                        description: "Estimated median home value in dollars (e.g., 450000)" 
                      },
                      median_income: { 
                        type: "number", 
                        description: "Estimated median household income in dollars (e.g., 75000)" 
                      },
                      writeup_html: { 
                        type: "string", 
                        description: "HTML formatted neighborhood description with h3 and p tags" 
                      }
                    },
                    required: ["median_home_value", "median_income", "writeup_html"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "provide_neighborhood_data" } }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for ${hood.neighborhood}:`, aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: "Rate limited - try again later" });
            break; // Stop processing if rate limited
          }
          
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        console.log(`AI response for ${hood.neighborhood}:`, JSON.stringify(aiData).substring(0, 500));

        // Extract tool call result
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall || toolCall.function?.name !== 'provide_neighborhood_data') {
          console.error(`No valid tool call for ${hood.neighborhood}`);
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: "No tool call in response" });
          continue;
        }

        const parsedArgs = JSON.parse(toolCall.function.arguments);
        console.log(`Parsed data for ${hood.neighborhood}:`, parsedArgs);

        // Validate the data
        const medianHomeValue = Number(parsedArgs.median_home_value);
        const medianIncome = Number(parsedArgs.median_income);
        const writeupHtml = parsedArgs.writeup_html;

        if (isNaN(medianHomeValue) || medianHomeValue < 50000 || medianHomeValue > 5000000) {
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: `Invalid home value: ${medianHomeValue}` });
          continue;
        }

        if (isNaN(medianIncome) || medianIncome < 20000 || medianIncome > 500000) {
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: `Invalid income: ${medianIncome}` });
          continue;
        }

        if (!writeupHtml || writeupHtml.length < 100) {
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: "Writeup too short" });
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would update ${hood.neighborhood}: home=$${medianHomeValue}, income=$${medianIncome}`);
          results.push({ 
            id: hood.id, 
            neighborhood: hood.neighborhood, 
            success: true, 
            error: `DRY RUN: home=$${medianHomeValue}, income=$${medianIncome}` 
          });
          continue;
        }

        // Update the database
        const { error: updateError } = await supabase
          .from('neighborhood_catalog')
          .update({
            median_home_value: medianHomeValue,
            median_income: medianIncome,
            writeup_html: writeupHtml,
            writeup_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', hood.id);

        if (updateError) {
          console.error(`Update error for ${hood.neighborhood}:`, updateError);
          results.push({ id: hood.id, neighborhood: hood.neighborhood, success: false, error: updateError.message });
          continue;
        }

        console.log(`Successfully enriched ${hood.neighborhood}: home=$${medianHomeValue}, income=$${medianIncome}`);
        results.push({ id: hood.id, neighborhood: hood.neighborhood, success: true });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`Error enriching ${hood.neighborhood}:`, err);
        results.push({ 
          id: hood.id, 
          neighborhood: hood.neighborhood, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      message: `Processed ${results.length} neighborhoods`,
      success: successCount,
      failed: failCount,
      results,
      remaining: neighborhoods.length - results.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('enrich-neighborhoods error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
