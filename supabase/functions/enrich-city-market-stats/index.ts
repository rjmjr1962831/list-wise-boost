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

interface NhToEnrich {
  neighborhood: string;
  neighborhoodSlug: string;
  cityArea: string;
  cityAreaSlug: string;
  state: string;
  stateAbbrev: string;
}

async function callDeepSeek(prompt: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a real estate market data analyst. Return ONLY valid JSON with market statistics. No explanations, no markdown, just JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const aiData = await response.json();
  let contentText = aiData.choices?.[0]?.message?.content || '';
  const jsonMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, contentText];
  contentText = jsonMatch[1].trim();
  return JSON.parse(contentText);
}

function normalizeStats(ms: any): any {
  ms.medianHomePrice = Number(ms.medianHomePrice) || 350000;
  ms.medianRent = Number(ms.medianRent) || 1500;
  ms.medianHouseholdIncome = Number(ms.medianHouseholdIncome) || 65000;
  ms.daysOnMarket = Number(ms.daysOnMarket) || 30;
  ms.pricePerSqFt = Number(ms.pricePerSqFt) || 200;
  ms.yearOverYearChange = Number(ms.yearOverYearChange) || 0.03;
  ms.averageHomeSize = Number(ms.averageHomeSize) || 1800;
  ms.homeownershipRate = Number(ms.homeownershipRate) || 0.65;
  ms.rentToIncomeRatio = Number(ms.rentToIncomeRatio) || 0.28;
  ms.rentalVacancyRate = Number(ms.rentalVacancyRate) || 0.05;
  ms.pctRenterOccupied = Number(ms.pctRenterOccupied) || (1 - ms.homeownershipRate);
  if (ms.population) ms.population = Number(ms.population);
  if (!ms.inventoryLevel) ms.inventoryLevel = "Moderate";
  if (!ms.marketType) ms.marketType = "Balanced";
  return ms;
}

const STATS_PROMPT_FIELDS = `{
  "medianHomePrice": <number>,
  "medianRent": <number - monthly>,
  "medianHouseholdIncome": <number>,
  "daysOnMarket": <number>,
  "pricePerSqFt": <number>,
  "yearOverYearChange": <number - decimal, e.g. 0.052 for 5.2%>,
  "inventoryLevel": "<Low|Moderate|High>",
  "marketType": "<Seller's Market|Buyer's Market|Balanced>",
  "averageHomeSize": <number - sqft>,
  "homeownershipRate": <number - decimal>,
  "pctRenterOccupied": <number - decimal>,
  "rentToIncomeRatio": <number - decimal>,
  "rentalVacancyRate": <number - decimal>
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cities, neighborhoods, mode = 'cities', dryRun = false, limit = 50, offset = 0, states } = body as {
      cities?: CityToEnrich[];
      neighborhoods?: NhToEnrich[];
      mode?: 'cities' | 'neighborhoods' | 'fix-keys';
      dryRun?: boolean;
      limit?: number;
      offset?: number;
      states?: string[]; // e.g. ["Arizona","California"] to filter
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    if (!DEEPSEEK_API_KEY && mode !== 'fix-keys') {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    // ─── MODE: fix-keys ───────────────────────────────────────────
    // Rename old-format neighborhood-{slug} to neighborhood-{citySlug}-{slug}
    if (mode === 'fix-keys') {
      const { data: oldEntries } = await supabase.rpc('run_sql', {
        query: `SELECT mc.id, mc.page, nc.city_area_slug, nc.neighborhood_slug
                FROM marketing_content mc
                JOIN neighborhood_catalog nc ON mc.page = 'neighborhood-' || nc.neighborhood_slug
                  AND mc.section = 'market_stats' AND mc.key = 'full_content'
                WHERE NOT EXISTS (
                  SELECT 1 FROM marketing_content mc2
                  WHERE mc2.page = 'neighborhood-' || nc.city_area_slug || '-' || nc.neighborhood_slug
                    AND mc2.section = 'market_stats' AND mc2.key = 'full_content'
                )
                LIMIT ${limit} OFFSET ${offset}`
      });

      const entries = oldEntries || [];
      let fixed = 0;
      for (const e of entries) {
        const newPage = `neighborhood-${e.city_area_slug}-${e.neighborhood_slug}`;
        if (!dryRun) {
          const { error } = await supabase
            .from('marketing_content')
            .update({ page: newPage, updated_at: new Date().toISOString() })
            .eq('id', e.id);
          if (error) {
            console.error(`Failed to fix ${e.page} -> ${newPage}:`, error);
            continue;
          }
        }
        fixed++;
        console.log(`${dryRun ? '[DRY] ' : ''}${e.page} -> ${newPage}`);
      }

      return new Response(JSON.stringify({ mode: 'fix-keys', found: entries.length, fixed, dryRun, offset }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── MODE: neighborhoods ──────────────────────────────────────
    if (mode === 'neighborhoods') {
      let nhsToProcess: NhToEnrich[] = neighborhoods || [];

      if (!neighborhoods || neighborhoods.length === 0) {
        // Find neighborhoods in neighborhood_catalog that lack market_stats
        const stateFilter = states && states.length > 0
          ? `AND nc.state IN (${states.map(s => `'${s}'`).join(',')})`
          : '';
        const { data: missing } = await supabase.rpc('run_sql', {
          query: `SELECT nc.neighborhood, nc.neighborhood_slug, nc.city_area, nc.city_area_slug, nc.state,
                    CASE WHEN nc.state = 'Arizona' THEN 'AZ' WHEN nc.state = 'California' THEN 'CA'
                         WHEN nc.state = 'Texas' THEN 'TX' WHEN nc.state = 'Florida' THEN 'FL'
                         WHEN nc.state = 'New York' THEN 'NY' WHEN nc.state = 'Colorado' THEN 'CO' ELSE 'XX' END as state_abbrev
                  FROM neighborhood_catalog nc
                  WHERE nc.is_active = true
                    ${stateFilter}
                    AND NOT EXISTS (
                      SELECT 1 FROM marketing_content mc
                      WHERE mc.page = 'neighborhood-' || nc.city_area_slug || '-' || nc.neighborhood_slug
                        AND mc.section = 'market_stats' AND mc.key = 'full_content'
                    )
                  ORDER BY nc.state, nc.city_area, nc.neighborhood
                  LIMIT ${limit} OFFSET ${offset}`
        });

        nhsToProcess = (missing || []).map((r: any) => ({
          neighborhood: r.neighborhood,
          neighborhoodSlug: r.neighborhood_slug,
          cityArea: r.city_area,
          cityAreaSlug: r.city_area_slug,
          state: r.state,
          stateAbbrev: r.state_abbrev,
        }));
      }

      console.log(`Processing ${nhsToProcess.length} neighborhoods for market stats`);
      const results: any[] = [];

      for (const nh of nhsToProcess) {
        try {
          const prompt = `Generate ONLY market statistics for the ${nh.neighborhood} neighborhood in ${nh.cityArea}, ${nh.stateAbbrev}.
Provide REALISTIC ESTIMATES based on Census ACS data and real estate market knowledge.
Return ONLY a JSON object: ${STATS_PROMPT_FIELDS}`;

          const marketStats = normalizeStats(await callDeepSeek(prompt, DEEPSEEK_API_KEY!));
          marketStats.metadata = {
            generatedAt: new Date().toISOString(),
            neighborhoodName: nh.neighborhood,
            cityArea: nh.cityArea,
            state: nh.state,
            stateAbbrev: nh.stateAbbrev,
            version: "2.0",
          };

          if (!dryRun) {
            const page = `neighborhood-${nh.cityAreaSlug}-${nh.neighborhoodSlug}`;
            const { error } = await supabase.from('marketing_content').upsert({
              page,
              section: 'market_stats',
              key: 'full_content',
              type: 'json',
              value: JSON.stringify(marketStats),
              active: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'page,section,key' });

            if (error) {
              // If upsert fails (no unique constraint), try insert
              const { error: insErr } = await supabase.from('marketing_content').insert({
                page,
                section: 'market_stats',
                key: 'full_content',
                type: 'json',
                value: JSON.stringify(marketStats),
                active: true,
              });
              if (insErr) {
                console.error(`Failed to save ${nh.neighborhood}:`, insErr);
                results.push({ name: nh.neighborhood, city: nh.cityArea, status: 'save_error' });
                continue;
              }
            }
          }

          console.log(`✓ ${nh.neighborhood}, ${nh.cityArea}: $${marketStats.medianHomePrice.toLocaleString()}, Rent $${marketStats.medianRent}`);
          results.push({ name: nh.neighborhood, city: nh.cityArea, status: 'success' });
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`Error: ${nh.neighborhood}:`, err);
          results.push({ name: nh.neighborhood, city: nh.cityArea, status: 'error' });
        }
      }

      const successful = results.filter(r => r.status === 'success').length;
      return new Response(JSON.stringify({ mode: 'neighborhoods', processed: nhsToProcess.length, successful, dryRun, offset, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── MODE: cities (default) ───────────────────────────────────
    let citiesToProcess: CityToEnrich[] = cities || [];

    if (!cities || cities.length === 0) {
      // If states filter given, get city slugs for those states first
      let citySlugFilter: Set<string> | null = null;
      if (states && states.length > 0) {
        const stateSlugs = states.map(s => s.toLowerCase());
        const { data: cityRows } = await supabase.from('cities').select('slug').in('state_slug', stateSlugs).eq('active', true);
        citySlugFilter = new Set((cityRows || []).map((c: any) => `city-${c.slug}`));
      }

      const { data: existingContent, error } = await supabase
        .from('marketing_content')
        .select('page, value')
        .eq('section', 'market_overview')
        .eq('key', 'full_content')
        .range(offset, offset + 2000 - 1);

      if (error) throw error;

      citiesToProcess = (existingContent || [])
        .filter(row => {
          if (citySlugFilter && !citySlugFilter.has(row.page)) return false;
          try {
            const parsed = JSON.parse(row.value);
            return !parsed.marketStats || !parsed.marketStats.medianRent;
          } catch { return false; }
        })
        .map(row => {
          const slug = row.page.replace('city-', '');
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
        .slice(0, limit);
    }

    console.log(`Processing ${citiesToProcess.length} cities for market stats enrichment`);
    const results: Array<{ city: string, status: string, marketStats?: any }> = [];

    for (const city of citiesToProcess) {
      try {
        const prompt = `Generate ONLY market statistics for ${city.cityName}, ${city.stateAbbrev}.
Provide REALISTIC ESTIMATES based on Census ACS data and real estate market knowledge.
Return ONLY a JSON object: ${STATS_PROMPT_FIELDS.replace('}', '  "population": <number>\n}')}`;

        const marketStats = normalizeStats(await callDeepSeek(prompt, DEEPSEEK_API_KEY!));
        if (!marketStats.population) marketStats.population = 50000;

        if (!dryRun) {
          const { data: existing } = await supabase
            .from('marketing_content')
            .select('value')
            .eq('page', `city-${city.citySlug}`)
            .eq('section', 'market_overview')
            .eq('key', 'full_content')
            .single();

          if (existing?.value) {
            const existingContent = JSON.parse(existing.value);
            existingContent.marketStats = marketStats;
            existingContent.metadata = {
              ...existingContent.metadata,
              marketStatsUpdatedAt: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('marketing_content')
              .update({ value: JSON.stringify(existingContent), updated_at: new Date().toISOString() })
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

        console.log(`✓ ${city.cityName}: Pop ${(marketStats.population || 0).toLocaleString()}, Median $${marketStats.medianHomePrice.toLocaleString()}, Rent $${marketStats.medianRent}`);
        results.push({ city: city.cityName, status: 'success', marketStats });
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (cityError) {
        console.error(`Error processing ${city.cityName}:`, cityError);
        results.push({ city: city.cityName, status: 'error', marketStats: null });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    return new Response(JSON.stringify({ mode: 'cities', processed: citiesToProcess.length, successful, dryRun, offset, results }), {
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
