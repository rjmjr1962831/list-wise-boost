import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch Memo23 enrichment for California agents from state_licenses table.
 * Pipeline: Exa (already done) → Memo23 (this function)
 * 
 * Takes agents that have zillow_url from Exa search but haven't been scraped yet,
 * enriches them via Memo23, and either:
 * - Creates new professionals records (if they qualify: 4.8+ rating, 20+ reviews)
 * - Updates state_licenses with scrape results
 * 
 * Concurrency: 5 concurrent requests per project rules
 */

interface StateLicense {
  id: string;
  name: string;
  license_number: string;
  city: string | null;
  brokerage_name: string | null;
  zillow_url: string;
}

interface EnrichmentResult {
  id: string;
  name: string;
  license_number: string;
  status: 'success' | 'failed' | 'not_qualified' | 'duplicate';
  rating?: number;
  reviews?: number;
  message?: string;
  professionalId?: string;
}

async function enrichAgent(
  agent: StateLicense,
  supabase: any,
  apifyToken: string,
  proxyUrl: string | null
): Promise<EnrichmentResult> {
  console.log(`🔄 Processing: ${agent.name} - ${agent.zillow_url}`);

  try {
    // Call Memo23 Apify actor
    const actorId = 'memo23~apify-zillow-agents-cheerio';
    const actorInput = {
      startUrls: [{ url: agent.zillow_url }],
      maxConcurrency: 5,
      maxRequestRetries: 5,
      requestHandlerTimeoutSecs: 180,
      proxyConfiguration: proxyUrl ? {
        useApifyProxy: false,
        proxyUrls: [proxyUrl]
      } : {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'US'
      }
    };

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Apify start failed: ${runResponse.status} ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`   Started Apify run: ${runId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120;
    let runStatus = 'RUNNING';
    let agentData = null;

    while (attempts < maxAttempts && runStatus === 'RUNNING') {
      const delay = Math.min(2000 * Math.pow(1.3, Math.floor(attempts / 10)), 15000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apifyToken}`
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;

        if (runStatus === 'SUCCEEDED') {
          const datasetId = statusData.data.defaultDatasetId;
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
          );

          if (datasetResponse.ok) {
            const results = await datasetResponse.json();
            if (results && results.length > 0) {
              agentData = results[0];
            }
          }
          break;
        } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
          throw new Error(`Apify run ${runStatus}`);
        }
      }
      attempts++;
    }

    if (!agentData) {
      // Update state_licenses with failure
      await supabase.from('state_licenses').update({
        zillow_scraped_at: new Date().toISOString(),
        memo23_status: 'no_data',
        memo23_error: 'No data returned from Memo23'
      }).eq('id', agent.id);

      return {
        id: agent.id,
        name: agent.name,
        license_number: agent.license_number,
        status: 'failed',
        message: 'No data returned from Memo23'
      };
    }

    // Extract rating and review count
    const rating = agentData.ratings?.average || 0;
    const reviewCount = agentData.ratings?.count || 0;

    console.log(`   ${agent.name}: ${rating}⭐ (${reviewCount} reviews)`);

    // Check prequalification: 4.8+ rating AND 20+ reviews
    if (rating < 4.8 || reviewCount < 20) {
      await supabase.from('state_licenses').update({
        zillow_scraped_at: new Date().toISOString(),
        memo23_status: 'not_qualified',
        memo23_rating: rating,
        memo23_reviews: reviewCount
      }).eq('id', agent.id);

      return {
        id: agent.id,
        name: agent.name,
        license_number: agent.license_number,
        status: 'not_qualified',
        rating,
        reviews: reviewCount,
        message: `Does not meet criteria: ${rating}⭐ / ${reviewCount} reviews`
      };
    }

    // Check for duplicates in professionals table
    const { data: existingPro } = await supabase
      .from('professionals')
      .select('id')
      .eq('license_number', agent.license_number)
      .maybeSingle();

    if (existingPro) {
      await supabase.from('state_licenses').update({
        zillow_scraped_at: new Date().toISOString(),
        memo23_status: 'duplicate',
        professional_id: existingPro.id
      }).eq('id', agent.id);

      return {
        id: agent.id,
        name: agent.name,
        license_number: agent.license_number,
        status: 'duplicate',
        professionalId: existingPro.id,
        message: 'Already exists in professionals table'
      };
    }

    // Agent qualifies! Create professional record
    // Get default category_id and city_id
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('state_slug', 'california')
      .limit(1)
      .maybeSingle();

    const professionalData: Record<string, any> = {
      name: agentData.name || agent.name,
      license_number: agent.license_number,
      zillow_profile_url: agent.zillow_url,
      active: true,
      state_slug: 'california',
      category_id: category?.id,
      city_id: city?.id,
      rank: 999, // Default rank for newly imported agents
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_source: 'memo23',
      zillow_last_scraped_at: new Date().toISOString(),
      zillow_scrape_status: 'success',
    };

    // Populate additional fields from Memo23 data
    if (agentData.screenName) professionalData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      professionalData.encoded_zuid = agentData.encodedZuid;
      professionalData.zuid = agentData.encodedZuid;
    }
    if (agentData.profilePhotoSrc) professionalData.image_url = agentData.profilePhotoSrc;
    if (agentData.businessName) {
      professionalData.business_name = agentData.businessName;
      professionalData.company = agentData.businessName;
    }
    if (agentData.businessAddress) {
      professionalData.business_address = agentData.businessAddress;
      professionalData.business_city = agentData.businessAddress.city || null;
      professionalData.business_state = agentData.businessAddress.state || null;
      professionalData.business_zip = agentData.businessAddress.postalCode || null;
    }
    if (agentData.phoneNumbers?.cell) {
      professionalData.phone = agentData.phoneNumbers.cell;
      professionalData.cell_phone = agentData.phoneNumbers.cell;
    }
    if (agentData.agentSalesStats) {
      professionalData.agent_sales_stats = agentData.agentSalesStats;
      professionalData.sales_count_all_time = agentData.agentSalesStats.countAllTime || null;
      professionalData.sales_count_last_year = agentData.agentSalesStats.countLastYear || null;
    }
    if (agentData.agentLicenses) {
      professionalData.agent_licenses = agentData.agentLicenses;
    }
    if (agentData.ratings) {
      professionalData.ratings = agentData.ratings;
    }

    // Insert into professionals
    const { data: newPro, error: insertError } = await supabase
      .from('professionals')
      .insert(professionalData)
      .select('id')
      .single();

    if (insertError) {
      console.error(`   Failed to insert professional: ${insertError.message}`);
      await supabase.from('state_licenses').update({
        zillow_scraped_at: new Date().toISOString(),
        memo23_status: 'insert_failed',
        memo23_error: insertError.message
      }).eq('id', agent.id);

      return {
        id: agent.id,
        name: agent.name,
        license_number: agent.license_number,
        status: 'failed',
        message: `Insert failed: ${insertError.message}`
      };
    }

    const professionalId = newPro.id;

    // Populate agent_licenses table
    if (agentData.agentLicenses && Array.isArray(agentData.agentLicenses)) {
      const licenses = agentData.agentLicenses.map((lic: any) => ({
        professional_id: professionalId,
        license_number: lic.text || lic.licenseNumber || agent.license_number,
        state: lic.state || 'CA',
        license_type: lic.type || null,
        status: lic.status || null,
        updated_at: new Date().toISOString()
      }));

      if (licenses.length > 0) {
        await supabase.from('agent_licenses')
          .upsert(licenses, { onConflict: 'professional_id,license_number,state' });
      }
    }

    // Populate agent_reviews table
    const reviews = agentData.reviews || [];
    if (Array.isArray(reviews) && reviews.length > 0) {
      const reviewRecords = reviews
        .filter((r: any) => r.reviewId && r.rating && r.createDate)
        .slice(0, 50) // Limit to 50 reviews
        .map((r: any) => ({
          professional_id: professionalId,
          zillow_review_id: parseInt(r.reviewId, 10),
          rating: Math.min(5, Math.max(1, parseInt(r.rating, 10))),
          comment: r.reviewText || null,
          review_date: r.createDate,
          updated_at: new Date().toISOString()
        }));

      if (reviewRecords.length > 0) {
        await supabase.from('agent_reviews')
          .upsert(reviewRecords, { onConflict: 'zillow_review_id' });
      }
    }

    // Update state_licenses with success
    await supabase.from('state_licenses').update({
      zillow_scraped_at: new Date().toISOString(),
      memo23_status: 'success',
      memo23_rating: rating,
      memo23_reviews: reviewCount,
      professional_id: professionalId
    }).eq('id', agent.id);

    console.log(`   ✅ Created professional: ${professionalId}`);

    return {
      id: agent.id,
      name: agent.name,
      license_number: agent.license_number,
      status: 'success',
      rating,
      reviews: reviewCount,
      professionalId,
      message: 'Created professional record'
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Error processing ${agent.name}: ${errorMsg}`);

    await supabase.from('state_licenses').update({
      zillow_scraped_at: new Date().toISOString(),
      memo23_status: 'error',
      memo23_error: errorMsg
    }).eq('id', agent.id);

    return {
      id: agent.id,
      name: agent.name,
      license_number: agent.license_number,
      status: 'failed',
      message: errorMsg
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 50, concurrency = 5, dryRun = false } = await req.json();

    console.log(`🚀 Starting batch Memo23 enrichment for CA agents`);
    console.log(`   Limit: ${limit}, Concurrency: ${concurrency}, DryRun: ${dryRun}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get CA agents with Zillow URLs that haven't been scraped
    const { data: agents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city, brokerage_name, zillow_url')
      .eq('state', 'CA')
      .not('zillow_url', 'is', null)
      .is('zillow_scraped_at', null)
      .order('exa_searched_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({
        message: 'No CA agents to process - all have been scraped',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${agents.length} agents to process`);

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        message: `Would process ${agents.length} agents`,
        agents: agents.map(a => ({ id: a.id, name: a.name, zillow_url: a.zillow_url }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const proxyUsername = Deno.env.get('ROTATING_PROXY_USERNAME');
    const proxyPassword = Deno.env.get('ROTATING_PROXY_PASSWORD');
    const proxyUrl = (proxyUsername && proxyPassword)
      ? `http://${proxyUsername}:${proxyPassword}@rp.scrapegw.com:6060`
      : null;

    const results: EnrichmentResult[] = [];

    // Process in batches with concurrency
    for (let i = 0; i < agents.length; i += concurrency) {
      const batch = agents.slice(i, i + concurrency);
      console.log(`\n📦 Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} agents)`);

      const batchResults = await Promise.all(
        batch.map(agent => enrichAgent(agent, supabase, apifyToken, proxyUrl))
      );

      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + concurrency < agents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summarize results
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      notQualified: results.filter(r => r.status === 'not_qualified').length,
      duplicate: results.filter(r => r.status === 'duplicate').length,
      failed: results.filter(r => r.status === 'failed').length
    };

    console.log(`\n🎉 Batch complete!`);
    console.log(`   Success: ${summary.success}`);
    console.log(`   Not Qualified: ${summary.notQualified}`);
    console.log(`   Duplicate: ${summary.duplicate}`);
    console.log(`   Failed: ${summary.failed}`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} CA agents`,
      summary,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Batch enrichment error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
