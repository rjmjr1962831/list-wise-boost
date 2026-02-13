import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enrich agent data using Memo23 Apify actor and populate all Zillow enrichment tables:
 * - professionals (update existing fields + new enrichment fields)
 * - agent_licenses
 * - agent_transactions
 * - agent_listings
 * - agent_reviews
 * - agent_team_members
 * 
 * Pipeline: Exa → Memo23 (this function handles Memo23 enrichment step)
 * Concurrency: Always use 5 concurrent requests per project rules
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, dryRun = false } = await req.json();

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    console.log(`🚀 Starting Memo23 enrichment for professional: ${professionalId}`);
    console.log(`   Dry run: ${dryRun}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get professional record
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${profError?.message}`);
    }

    if (!professional.zillow_profile_url) {
      throw new Error('No Zillow profile URL found for this professional');
    }

    console.log(`📋 Enriching: ${professional.name} - ${professional.zillow_profile_url}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const proxyUsername = Deno.env.get('ROTATING_PROXY_USERNAME');
    const proxyPassword = Deno.env.get('ROTATING_PROXY_PASSWORD');
    const proxyUrl = (proxyUsername && proxyPassword)
      ? `http://${proxyUsername}:${proxyPassword}@rp.scrapegw.com:6060`
      : null;

    // Call Memo23 Apify actor
    const actorId = 'memo23~apify-zillow-agents-cheerio';
    const actorInput = {
      startUrls: [{ url: professional.zillow_profile_url }],
      maxConcurrency: 5, // Per project rules: always use 5 concurrences
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

    console.log('🔄 Starting Memo23 actor...');
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
      throw new Error(`Failed to start Apify run: ${runResponse.status} ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`✅ Memo23 run started: ${runId}`);

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
              console.log(`✅ Memo23 data received for ${professional.name}`);
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
      // Update scrape status to failed
      await supabase.from('professionals').update({
        zillow_scrape_status: 'failed',
        zillow_scrape_error: 'No data returned from Memo23',
        zillow_last_scraped_at: new Date().toISOString()
      }).eq('id', professionalId);

      throw new Error('No data returned from Memo23 actor');
    }

    // ============================================
    // PART 1: Update professionals table with new fields
    // ============================================
    const updateData: Record<string, any> = {
      zillow_data_fetched_at: new Date().toISOString(),
      zillow_last_scraped_at: new Date().toISOString(),
      zillow_scrape_status: 'success',
      zillow_scrape_error: null,
      zillow_data_source: 'memo23',
      raw_scraper_data: agentData, // Store complete raw data from memo23
    };

    // Basic fields
    if (agentData.name) updateData.name = agentData.name;
    if (agentData.screenName) updateData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      updateData.encoded_zuid = agentData.encodedZuid;
      updateData.zuid = agentData.encodedZuid;
    }
    if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;
    
    // Business address extraction
    if (agentData.businessAddress) {
      updateData.business_address = agentData.businessAddress;
      updateData.business_city = agentData.businessAddress.city || null;
      updateData.business_state = agentData.businessAddress.state || null;
      updateData.business_zip = agentData.businessAddress.postalCode || null;
      if (agentData.businessAddress.postalCode) {
        updateData.zip_code = agentData.businessAddress.postalCode;
      }
    }
    if (agentData.businessName) {
      updateData.business_name = agentData.businessName;
      updateData.company = agentData.businessName;
    }

    // Ratings
    if (agentData.ratings) {
      updateData.ratings = agentData.ratings;
      if (agentData.ratings.average !== undefined) {
        updateData.review_stars_rating = agentData.ratings.average;
      }
      if (agentData.ratings.count !== undefined) {
        updateData.num_total_reviews = agentData.ratings.count;
      }
    }

    // Phone numbers
    if (agentData.phoneNumbers) {
      updateData.phone_numbers = agentData.phoneNumbers;
      if (agentData.phoneNumbers.cell) {
        updateData.phone = agentData.phoneNumbers.cell;
        updateData.cell_phone = agentData.phoneNumbers.cell;
      }
    }

    // Sales stats
    if (agentData.agentSalesStats) {
      updateData.agent_sales_stats = agentData.agentSalesStats;
      updateData.sales_count_all_time = agentData.agentSalesStats.countAllTime || null;
      updateData.sales_count_last_year = agentData.agentSalesStats.countLastYear || null;
      if (agentData.agentSalesStats.priceRange) {
        updateData.price_range_3yr_min = agentData.agentSalesStats.priceRange.min || null;
        updateData.price_range_3yr_max = agentData.agentSalesStats.priceRange.max || null;
      }
      updateData.stats_include_team = agentData.agentSalesStats.includeTeam || false;
    }

    // Team detection
    if (agentData.teamDisplayInformation) {
      updateData.team_display_information = agentData.teamDisplayInformation;
      if (agentData.teamDisplayInformation.teamLeadInfo?.children?.length > 0) {
        updateData.is_team_lead = true;
      }
      if (agentData.teamDisplayInformation.teamMemberInfo?.teamLead?.zuid) {
        updateData.team_lead_zuid = agentData.teamDisplayInformation.teamMemberInfo.teamLead.zuid;
      }
    }

    // Licenses
    if (agentData.agentLicenses) {
      updateData.agent_licenses = agentData.agentLicenses;
      if (agentData.agentLicenses.length > 0 && agentData.agentLicenses[0].text) {
        updateData.license_number = agentData.agentLicenses[0].text;
      }
    }

    // Update professionals table
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professionalId);

    if (updateError) {
      console.error('Failed to update professionals:', updateError);
    } else {
      console.log('✅ Updated professionals table');
    }

    // ============================================
    // PART 2: Populate agent_licenses
    // ============================================
    if (agentData.agentLicenses && Array.isArray(agentData.agentLicenses)) {
      const licenses = agentData.agentLicenses.map((lic: any) => ({
        professional_id: professionalId,
        license_number: lic.text || lic.licenseNumber || 'unknown',
        state: lic.state || professional.state_slug || 'unknown',
        license_type: lic.type || null,
        status: lic.status || null,
        updated_at: new Date().toISOString()
      }));

      if (licenses.length > 0) {
        const { error } = await supabase
          .from('agent_licenses')
          .upsert(licenses, { onConflict: 'professional_id,license_number,state' });
        if (error) console.error('Failed to upsert licenses:', error);
        else console.log(`✅ Upserted ${licenses.length} licenses`);
      }
    }

    // ============================================
    // PART 3: Populate agent_transactions (past sales)
    // ============================================
    const pastSales = agentData.pastSales || agentData.past_sales || [];
    if (Array.isArray(pastSales) && pastSales.length > 0) {
      const transactions = pastSales
        .filter((sale: any) => sale.zpid && sale.soldDate && sale.price)
        .map((sale: any) => ({
          professional_id: professionalId,
          zillow_zpid: parseInt(sale.zpid, 10),
          represented_list: JSON.stringify(sale.represented || ['buyer']),
          sold_date: sale.soldDate,
          price: parseInt(sale.price, 10),
          street_address: sale.address?.streetAddress || null,
          city: sale.address?.city || null,
          state: sale.address?.state || null,
          zip_code: sale.address?.zipcode || null,
          bedrooms: sale.bedrooms || null,
          bathrooms: sale.bathrooms || null,
          living_area_sqft: sale.livingArea || null,
          image_url: sale.imgSrc || null,
          home_details_url: sale.detailUrl || null,
          updated_at: new Date().toISOString()
        }));

      if (transactions.length > 0) {
        const { error } = await supabase
          .from('agent_transactions')
          .upsert(transactions, { onConflict: 'professional_id,zillow_zpid,sold_date' });
        if (error) console.error('Failed to upsert transactions:', error);
        else console.log(`✅ Upserted ${transactions.length} transactions`);
      }
    }

    // ============================================
    // PART 4: Populate agent_listings
    // ============================================
    const forSaleListings = Array.isArray(agentData.forSaleListings) ? agentData.forSaleListings : [];
    const forRentListings = Array.isArray(agentData.forRentListings) ? agentData.forRentListings : [];
    const allListings = [
      ...forSaleListings.map((l: any) => ({ ...l, listing_type: 'for_sale' })),
      ...forRentListings.map((l: any) => ({ ...l, listing_type: 'for_rent' }))
    ];

    if (allListings.length > 0) {
      const listings = allListings
        .filter((l: any) => l.zpid && l.price)
        .map((l: any) => ({
          professional_id: professionalId,
          zillow_zpid: parseInt(l.zpid, 10),
          listing_type: l.listing_type,
          home_type: l.homeType || null,
          status: l.homeStatus || null,
          street_address: l.address?.streetAddress || null,
          city: l.address?.city || null,
          state: l.address?.state || null,
          zip_code: l.address?.zipcode || null,
          price: parseInt(l.price, 10),
          bedrooms: l.bedrooms || null,
          bathrooms: l.bathrooms || null,
          primary_photo_url: l.imgSrc || null,
          listing_url: l.detailUrl || null,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      if (listings.length > 0) {
        const { error } = await supabase
          .from('agent_listings')
          .upsert(listings, { onConflict: 'zillow_zpid' });
        if (error) console.error('Failed to upsert listings:', error);
        else console.log(`✅ Upserted ${listings.length} listings`);
      }
    }

    // ============================================
    // PART 5: Populate agent_reviews
    // ============================================
    const reviews = agentData.reviews || [];
    if (Array.isArray(reviews) && reviews.length > 0) {
      const reviewRecords = reviews
        .filter((r: any) => r.reviewId && r.rating && r.createDate)
        .map((r: any) => ({
          professional_id: professionalId,
          zillow_review_id: parseInt(r.reviewId, 10),
          rating: Math.min(5, Math.max(1, parseInt(r.rating, 10))),
          comment: r.reviewText || null,
          work_description: r.description || null,
          review_date: r.createDate,
          local_knowledge_score: r.subRatings?.localKnowledge || null,
          process_expertise_score: r.subRatings?.processExpertise || null,
          responsiveness_score: r.subRatings?.responsiveness || null,
          negotiation_skills_score: r.subRatings?.negotiationSkills || null,
          reviewer_screen_name: r.reviewer?.screenName || null,
          updated_at: new Date().toISOString()
        }));

      if (reviewRecords.length > 0) {
        const { error } = await supabase
          .from('agent_reviews')
          .upsert(reviewRecords, { onConflict: 'zillow_review_id' });
        if (error) console.error('Failed to upsert reviews:', error);
        else console.log(`✅ Upserted ${reviewRecords.length} reviews`);
      }
    }

    console.log(`🎉 Memo23 enrichment complete for ${professional.name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        professionalId,
        name: professional.name,
        message: 'Memo23 enrichment complete'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Memo23 enrichment error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
