import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CityToEnrich {
  cityName: string;
  citySlug: string;
  stateName: string;
  stateAbbrev: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cities, dryRun = false } = await req.json() as { cities?: CityToEnrich[], dryRun?: boolean };
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // If no cities provided, fetch cities that have existing content but no marketStats
    let citiesToProcess: CityToEnrich[] = cities || [];
    
    if (!cities || cities.length === 0) {
      // Get all cities with existing market_overview content
      const { data: existingContent, error } = await supabase
        .from('marketing_content')
        .select('page, value')
        .eq('section', 'market_overview')
        .eq('key', 'full_content');
      
      if (error) throw error;
      
      // Parse city info from page names and check if they need marketStats
      citiesToProcess = (existingContent || [])
        .filter(row => {
          try {
            const parsed = JSON.parse(row.value);
            // Include if no marketStats or missing key fields
            return !parsed.marketStats || !parsed.marketStats.medianRent;
          } catch {
            return false;
          }
        })
        .map(row => {
          const slug = row.page.replace('city-', '');
          // Try to extract city name from existing content
          try {
            const parsed = JSON.parse(row.value);
            return {
              citySlug: slug,
              cityName: parsed.metadata?.cityName || slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              stateName: parsed.metadata?.stateName || 'Unknown',
              stateAbbrev: parsed.metadata?.stateAbbrev || 'XX'
            };
          } catch {
            return {
              citySlug: slug,
              cityName: slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              stateName: 'Unknown',
              stateAbbrev: 'XX'
            };
          }
        })
        .slice(0, 10); // Process max 10 at a time
    }

    console.log(`Processing ${citiesToProcess.length} cities for market stats enrichment`);
    
    const results: Array<{ city: string, status: string, marketStats?: any }> = [];

    for (const city of citiesToProcess) {
      try {
        console.log(`Generating market stats for ${city.cityName}, ${city.stateAbbrev}...`);
        
        const prompt = `Generate ONLY market statistics for ${city.cityName}, ${city.stateAbbrev}. 

Provide REALISTIC ESTIMATES based on your knowledge of this city's real estate market, demographics, and Census ACS data.

Return ONLY a JSON object with these exact fields (no other text):

{
  "population": <number - estimated population>,
  "medianHomePrice": <number - median home price in dollars>,
  "medianRent": <number - median monthly rent from Census ACS data>,
  "medianHouseholdIncome": <number - median household income>,
  "daysOnMarket": <number - average days on market>,
  "pricePerSqFt": <number - price per square foot>,
  "yearOverYearChange": <number - YoY price change as decimal, e.g. 0.052 for 5.2%>,
  "inventoryLevel": "<string - 'Low', 'Moderate', or 'High'>",
  "marketType": "<string - 'Seller's Market', 'Buyer's Market', or 'Balanced'>",
  "averageHomeSize": <number - average home size in sqft>,
  "homeownershipRate": <number - as decimal, e.g. 0.62 for 62%>,
  "rentToIncomeRatio": <number - median rent as percentage of median income, e.g. 0.28>
}`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { 
                role: 'system', 
                content: `You are a real estate market data analyst. Return ONLY valid JSON with market statistics. No explanations, no markdown, just JSON.` 
              },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`AI error for ${city.cityName}:`, response.status, errorText);
          results.push({ city: city.cityName, status: 'error', marketStats: null });
          continue;
        }

        const aiData = await response.json();
        let contentText = aiData.choices?.[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, contentText];
        contentText = jsonMatch[1].trim();
        
        let marketStats;
        try {
          marketStats = JSON.parse(contentText);
        } catch (parseError) {
          console.error(`Failed to parse response for ${city.cityName}:`, contentText);
          results.push({ city: city.cityName, status: 'parse_error', marketStats: null });
          continue;
        }

        // Validate and normalize numeric fields
        marketStats.population = Number(marketStats.population) || 50000;
        marketStats.medianHomePrice = Number(marketStats.medianHomePrice) || 350000;
        marketStats.medianRent = Number(marketStats.medianRent) || 1500;
        marketStats.medianHouseholdIncome = Number(marketStats.medianHouseholdIncome) || 65000;
        marketStats.daysOnMarket = Number(marketStats.daysOnMarket) || 30;
        marketStats.pricePerSqFt = Number(marketStats.pricePerSqFt) || 200;
        marketStats.yearOverYearChange = Number(marketStats.yearOverYearChange) || 0.03;
        marketStats.averageHomeSize = Number(marketStats.averageHomeSize) || 1800;
        marketStats.homeownershipRate = Number(marketStats.homeownershipRate) || 0.65;
        marketStats.rentToIncomeRatio = Number(marketStats.rentToIncomeRatio) || 0.28;

        if (!dryRun) {
          // Get existing content
          const { data: existing } = await supabase
            .from('marketing_content')
            .select('value')
            .eq('page', `city-${city.citySlug}`)
            .eq('section', 'market_overview')
            .eq('key', 'full_content')
            .single();

          if (existing?.value) {
            // Merge marketStats into existing content
            const existingContent = JSON.parse(existing.value);
            existingContent.marketStats = marketStats;
            existingContent.metadata = {
              ...existingContent.metadata,
              marketStatsUpdatedAt: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('marketing_content')
              .update({
                value: JSON.stringify(existingContent),
                updated_at: new Date().toISOString()
              })
              .eq('page', `city-${city.citySlug}`)
              .eq('section', 'market_overview')
              .eq('key', 'full_content');

            if (updateError) {
              console.error(`Failed to update ${city.cityName}:`, updateError);
              results.push({ city: city.cityName, status: 'update_error', marketStats });
              continue;
            }
          }
        }

        console.log(`✓ ${city.cityName}: Pop ${marketStats.population.toLocaleString()}, Median $${marketStats.medianHomePrice.toLocaleString()}, Rent $${marketStats.medianRent}`);
        results.push({ city: city.cityName, status: 'success', marketStats });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (cityError) {
        console.error(`Error processing ${city.cityName}:`, cityError);
        results.push({ city: city.cityName, status: 'error', marketStats: null });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    console.log(`Completed: ${successful}/${citiesToProcess.length} cities enriched`);

    return new Response(JSON.stringify({ 
      processed: citiesToProcess.length,
      successful,
      dryRun,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enrich-city-market-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
