import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get 5 random active professionals to test
    const { data: professionals, error: dbError } = await supabase
      .from('professionals')
      .select('id, name, company, business_name, city_id, cities(name, state)')
      .eq('active', true)
      .not('email', 'is', null)
      .gte('review_stars_rating', 4.5)
      .gte('num_total_reviews', 50)
      .limit(5);

    if (dbError) throw dbError;

    console.log(`Testing Exa.ai with ${professionals?.length || 0} agents`);

    const results = [];

    for (const prof of professionals || []) {
      const city = (prof.cities as any)?.name || 'Unknown';
      const state = (prof.cities as any)?.state || 'AZ';
      const company = prof.company || prof.business_name || '';
      
      // Build search query with identity disambiguation
      const searchQuery = `"${prof.name}" real estate agent ${city} ${state} ${company}`.trim();
      
      console.log(`\n--- Searching for: ${prof.name} ---`);
      console.log(`Query: ${searchQuery}`);

      const startTime = Date.now();

      // Exa.ai search with contents
      const exaResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'x-api-key': EXA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          useAutoprompt: true,
          numResults: 10,
          type: 'auto', // Let Exa choose best search type
          contents: {
            text: { maxCharacters: 1000 },
            highlights: true,
          },
          // Focus on news/press sources
          category: 'news',
        }),
      });

      const elapsed = Date.now() - startTime;

      if (!exaResponse.ok) {
        const errorText = await exaResponse.text();
        console.error(`Exa API error for ${prof.name}:`, exaResponse.status, errorText);
        results.push({
          professional: prof.name,
          company,
          city: `${city}, ${state}`,
          success: false,
          error: `${exaResponse.status}: ${errorText}`,
          elapsed_ms: elapsed,
        });
        continue;
      }

      const exaData = await exaResponse.json();
      
      // Filter results that actually match this agent (John Smith problem)
      const matchedResults = (exaData.results || []).filter((result: any) => {
        const content = (result.text || '').toLowerCase() + ' ' + (result.title || '').toLowerCase();
        const nameLower = prof.name.toLowerCase();
        const companyLower = company.toLowerCase();
        const cityLower = city.toLowerCase();
        
        // Must contain the name
        if (!content.includes(nameLower)) return false;
        
        // Must also contain company OR city (two-attribute match)
        if (companyLower && content.includes(companyLower)) return true;
        if (content.includes(cityLower)) return true;
        if (content.includes(state.toLowerCase())) return true;
        
        return false;
      });

      console.log(`Found ${exaData.results?.length || 0} results, ${matchedResults.length} matched identity`);

      // Extract key info from matched results
      const mentions = matchedResults.slice(0, 5).map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.highlights?.[0] || result.text?.substring(0, 200) || '',
        publishedDate: result.publishedDate,
      }));

      results.push({
        professional: prof.name,
        company,
        city: `${city}, ${state}`,
        success: true,
        total_results: exaData.results?.length || 0,
        matched_results: matchedResults.length,
        elapsed_ms: elapsed,
        mentions,
      });
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const totalMentions = results.reduce((sum, r) => sum + (r.matched_results || 0), 0);
    const avgTime = Math.round(results.reduce((sum, r) => sum + (r.elapsed_ms || 0), 0) / results.length);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Tested: ${results.length} agents`);
    console.log(`Success: ${successCount}`);
    console.log(`Total matched mentions: ${totalMentions}`);
    console.log(`Avg response time: ${avgTime}ms`);

    return new Response(JSON.stringify({
      summary: {
        tested: results.length,
        success: successCount,
        total_matched_mentions: totalMentions,
        avg_response_ms: avgTime,
      },
      results,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-exa-search:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
