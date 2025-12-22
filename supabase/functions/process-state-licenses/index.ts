import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentResult {
  name: string;
  licenseNumber: string;
  city: string;
  status: 'qualified' | 'not_qualified' | 'duplicate' | 'error' | 'no_result';
  zillowUrl?: string;
  rating?: number;
  reviewCount?: number;
  error?: string;
}

interface ProcessingStats {
  processed: number;
  qualified: number;
  notQualified: number;
  duplicates: number;
  noResults: number;
  errors: number;
}

// Process a single agent: search Rigelbytes, qualify, insert if good
async function processAgent(
  agent: { name: string; license_number: string; city: string },
  state: string,
  stateAbbr: string,
  categoryId: string,
  supabase: any,
  apifyToken: string
): Promise<AgentResult> {
  const { name, license_number, city } = agent;
  
  try {
    // 1. Check for duplicate by license number first
    const { data: existingByLicense } = await supabase
      .from('professionals')
      .select('id, zillow_profile_url')
      .eq('license_number', license_number)
      .maybeSingle();

    if (existingByLicense) {
      console.log(`[${name}] Duplicate by license number`);
      return { name, licenseNumber: license_number, city, status: 'duplicate' };
    }

    // 2. Call Rigelbytes with single agent search
    const actorId = 'rigelbytes~zillow-agents';
    const searchQuery = `${name}, ${city}, ${stateAbbr}`;
    
    console.log(`[${name}] Searching Rigelbytes: "${searchQuery}"`);
    
    const actorInput = {
      search_keywords: [searchQuery],
      max_agents: 1,
      detailed_profiles: false, // We just need rating and review count
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    };

    // Start the run and wait for it (should be ~30 seconds)
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error(`[${name}] Rigelbytes failed:`, errorText);
      return { name, licenseNumber: license_number, city, status: 'error', error: `API error: ${runResponse.status}` };
    }

    const agents = await runResponse.json();
    
    if (!agents || agents.length === 0) {
      console.log(`[${name}] No Zillow profile found`);
      return { name, licenseNumber: license_number, city, status: 'no_result' };
    }

    const zillowAgent = agents[0];
    const rating = zillowAgent.rating || zillowAgent.review_stars_rating || 0;
    const reviewCount = zillowAgent.num_total_reviews || zillowAgent.reviews_count || 0;
    const zillowUrl = zillowAgent.profile_url || zillowAgent.zillow_profile_url || zillowAgent.profileLink;

    console.log(`[${name}] Found: rating=${rating}, reviews=${reviewCount}`);

    // 3. Check qualification: 4.5+ stars and 50+ reviews
    if (rating < 4.5 || reviewCount < 50) {
      console.log(`[${name}] Not qualified (${rating} stars, ${reviewCount} reviews)`);
      return { 
        name, 
        licenseNumber: license_number, 
        city, 
        status: 'not_qualified',
        rating,
        reviewCount,
        zillowUrl
      };
    }

    // 4. Check duplicate by Zillow URL
    if (zillowUrl) {
      const { data: existingByZillow } = await supabase
        .from('professionals')
        .select('id')
        .eq('zillow_profile_url', zillowUrl)
        .maybeSingle();

      if (existingByZillow) {
        console.log(`[${name}] Duplicate by Zillow URL`);
        return { name, licenseNumber: license_number, city, status: 'duplicate', zillowUrl, rating, reviewCount };
      }
    }

    // 5. Get or create city record
    let { data: cityRecord } = await supabase
      .from('cities')
      .select('id')
      .eq('name', city)
      .eq('state', state)
      .maybeSingle();

    if (!cityRecord) {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: newCity, error: cityError } = await supabase
        .from('cities')
        .insert({
          name: city,
          slug: citySlug,
          state: state,
          state_slug: state.toLowerCase().replace(/\s+/g, '-'),
          active: true
        })
        .select('id')
        .single();

      if (cityError) {
        console.error(`[${name}] Failed to create city:`, cityError);
        return { name, licenseNumber: license_number, city, status: 'error', error: `City creation failed` };
      }
      cityRecord = newCity;
    }

    // 6. Insert professional
    const { data: professional, error: insertError } = await supabase
      .from('professionals')
      .insert({
        name: zillowAgent.name || name,
        license_number: license_number,
        city_id: cityRecord.id,
        category_id: categoryId,
        type: 'scraped',
        rank: 999, // Will be updated later
        active: true,
        zillow_profile_url: zillowUrl,
        review_stars_rating: rating,
        num_total_reviews: reviewCount,
        company: zillowAgent.brokerage_name || zillowAgent.company || null,
        image_url: zillowAgent.image_url || zillowAgent.photo_url || null,
        phone: zillowAgent.phone || null,
        email: zillowAgent.email || null,
        address: zillowAgent.address || null,
        raw_scraper_data: zillowAgent,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`[${name}] Insert failed:`, insertError);
      return { name, licenseNumber: license_number, city, status: 'error', error: insertError.message };
    }

    // 7. Queue for enrichment
    await supabase
      .from('contact_enrichment_queue')
      .insert({
        professional_id: professional.id,
        status: 'pending',
        reason: 'New qualified agent from state pipeline',
        stage: 'queued'
      });

    console.log(`[${name}] ✅ Qualified and queued for enrichment`);
    return { 
      name, 
      licenseNumber: license_number, 
      city, 
      status: 'qualified',
      zillowUrl,
      rating,
      reviewCount
    };

  } catch (error) {
    console.error(`[${name}] Error:`, error);
    return { 
      name, 
      licenseNumber: license_number, 
      city, 
      status: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      state = 'California', 
      stateAbbr = 'CA', 
      startIndex = 0, 
      batchSize = 50,
      concurrency = 5
    } = await req.json();

    console.log(`\n========================================`);
    console.log(`Processing ${state} (${stateAbbr}) agents`);
    console.log(`Start: ${startIndex}, Batch: ${batchSize}, Concurrency: ${concurrency}`);
    console.log(`========================================\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Get category ID
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (!category) {
      throw new Error('Real estate agents category not found');
    }

    // Get agents from state_licenses
    const { data: licenses, error: licensesError } = await supabase
      .from('state_licenses')
      .select('name, license_number, city')
      .eq('state', stateAbbr)
      .not('city', 'is', null)
      .order('city', { ascending: true })
      .range(startIndex, startIndex + batchSize - 1);

    if (licensesError) {
      throw new Error(`Failed to fetch licenses: ${licensesError.message}`);
    }

    if (!licenses || licenses.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No more licenses to process',
          startIndex,
          processed: 0,
          complete: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${licenses.length} licenses to process`);

    const stats: ProcessingStats = {
      processed: 0,
      qualified: 0,
      notQualified: 0,
      duplicates: 0,
      noResults: 0,
      errors: 0
    };

    const results: AgentResult[] = [];

    // Process in batches of `concurrency`
    for (let i = 0; i < licenses.length; i += concurrency) {
      const batch = licenses.slice(i, i + concurrency);
      console.log(`\nProcessing batch ${Math.floor(i/concurrency) + 1}: agents ${i+1}-${Math.min(i+concurrency, licenses.length)}`);

      const batchResults = await Promise.all(
        batch.map(agent => processAgent(agent, state, stateAbbr, category.id, supabase, apifyToken))
      );

      for (const result of batchResults) {
        results.push(result);
        stats.processed++;
        
        switch (result.status) {
          case 'qualified':
            stats.qualified++;
            break;
          case 'not_qualified':
            stats.notQualified++;
            break;
          case 'duplicate':
            stats.duplicates++;
            break;
          case 'no_result':
            stats.noResults++;
            break;
          case 'error':
            stats.errors++;
            break;
        }
      }

      console.log(`Batch complete. Running totals: qualified=${stats.qualified}, not_qualified=${stats.notQualified}, duplicates=${stats.duplicates}`);
    }

    const nextIndex = startIndex + licenses.length;
    
    // Check if there are more licenses
    const { count } = await supabase
      .from('state_licenses')
      .select('*', { count: 'exact', head: true })
      .eq('state', stateAbbr)
      .not('city', 'is', null);

    const hasMore = nextIndex < (count || 0);

    console.log(`\n========================================`);
    console.log(`BATCH COMPLETE`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Qualified: ${stats.qualified}`);
    console.log(`Not Qualified: ${stats.notQualified}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    console.log(`No Results: ${stats.noResults}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Next Index: ${hasMore ? nextIndex : 'COMPLETE'}`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        state,
        stateAbbr,
        startIndex,
        nextIndex: hasMore ? nextIndex : null,
        totalInState: count,
        hasMore,
        stats,
        results: results.slice(0, 20), // Only return first 20 for response size
        message: hasMore 
          ? `Processed ${stats.processed}. ${stats.qualified} qualified. Continue at index ${nextIndex}.`
          : `Batch complete! ${stats.qualified} agents qualified and queued for enrichment.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-state-licenses:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
