import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch Memo23 enrichment for agents.
 * 
 * Supports two modes:
 * 1. state_licenses mode: Process agents from state_licenses table (CA, etc.)
 * 2. professionals mode: Re-enrich existing professionals (for AZ agents already in system)
 * 
 * Captures ALL fields from memo23 including:
 * - agent_licenses, agent_transactions, agent_listings, agent_reviews, agent_team_members
 * - All professional fields (business_address, sales_stats, team info, etc.)
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
  tablesPopulated?: string[];
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
    const actorId = 'memo23~zillow-agents-leads-scraper-ppe';
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

    // Extract rating and review count from Memo23
    const rating = agentData.ratings?.average || 0;
    const reviewCount = agentData.ratings?.count || 0;

    console.log(`   ${agent.name}: ${rating}⭐ (${reviewCount} reviews)`);

    // Prequalification check: 4.8+ rating AND 20+ reviews
    // Store data but only create professional record if qualified
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

    // Agent qualifies! Create professional record with ALL memo23 fields
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

    // Build comprehensive professional data with ALL memo23 fields
    const professionalData: Record<string, any> = {
      name: agentData.name || agent.name,
      license_number: agent.license_number,
      zillow_profile_url: agent.zillow_url,
      active: true,
      type: 'individual',
      state_slug: 'california',
      category_id: category?.id,
      city_id: city?.id,
      rank: 999,
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_source: 'memo23',
      zillow_data_fetched_at: new Date().toISOString(),
      zillow_last_scraped_at: new Date().toISOString(),
      zillow_scrape_status: 'success',
    };

    // Basic fields
    if (agentData.screenName) professionalData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      professionalData.encoded_zuid = agentData.encodedZuid;
      professionalData.zuid = agentData.encodedZuid;
    }
    if (agentData.profilePhotoSrc) professionalData.image_url = agentData.profilePhotoSrc;

    // Business info
    if (agentData.businessName) {
      professionalData.business_name = agentData.businessName;
      professionalData.company = agentData.businessName;
    }
    if (agentData.businessAddress) {
      professionalData.business_address = agentData.businessAddress;
      professionalData.business_city = agentData.businessAddress.city || null;
      professionalData.business_state = agentData.businessAddress.state || null;
      professionalData.business_zip = agentData.businessAddress.postalCode || null;
      if (agentData.businessAddress.postalCode) {
        professionalData.zip_code = agentData.businessAddress.postalCode;
      }
    }

    // Phone numbers
    if (agentData.phoneNumbers) {
      professionalData.phone_numbers = agentData.phoneNumbers;
      if (agentData.phoneNumbers.cell) {
        professionalData.phone = agentData.phoneNumbers.cell;
        professionalData.cell_phone = agentData.phoneNumbers.cell;
      }
    }

    // Ratings
    if (agentData.ratings) {
      professionalData.ratings = agentData.ratings;
    }

    // Sales stats
    if (agentData.agentSalesStats) {
      professionalData.agent_sales_stats = agentData.agentSalesStats;
      professionalData.sales_count_all_time = agentData.agentSalesStats.countAllTime || null;
      professionalData.sales_count_last_year = agentData.agentSalesStats.countLastYear || null;
      if (agentData.agentSalesStats.priceRange) {
        professionalData.price_range_3yr_min = agentData.agentSalesStats.priceRange.min || null;
        professionalData.price_range_3yr_max = agentData.agentSalesStats.priceRange.max || null;
      }
      if (agentData.agentSalesStats.averageValue) {
        professionalData.average_value_3yr = agentData.agentSalesStats.averageValue || null;
      }
      professionalData.stats_include_team = agentData.agentSalesStats.includeTeam || false;
    }

    // Team detection
    if (agentData.teamDisplayInformation) {
      professionalData.team_display_information = agentData.teamDisplayInformation;
      if (agentData.teamDisplayInformation.teamLeadInfo?.children?.length > 0) {
        professionalData.is_team_lead = true;
      }
      if (agentData.teamDisplayInformation.teamMemberInfo?.teamLead?.zuid) {
        professionalData.team_lead_zuid = agentData.teamDisplayInformation.teamMemberInfo.teamLead.zuid;
      }
    }

    // Licenses
    if (agentData.agentLicenses) {
      professionalData.agent_licenses = agentData.agentLicenses;
    }

    // Active listings count
    if (agentData.forSaleCount !== undefined) {
      professionalData.active_for_sale_count = agentData.forSaleCount;
    }
    if (agentData.forRentCount !== undefined) {
      professionalData.active_for_rent_count = agentData.forRentCount;
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
    const tablesPopulated: string[] = ['professionals'];

    // ============================================
    // Populate agent_licenses
    // ============================================
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
        const { error } = await supabase.from('agent_licenses')
          .upsert(licenses, { onConflict: 'professional_id,license_number,state' });
        if (!error) tablesPopulated.push('agent_licenses');
      }
    }

    // ============================================
    // Populate agent_transactions (past sales)
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
        const { error } = await supabase.from('agent_transactions')
          .upsert(transactions, { onConflict: 'professional_id,zillow_zpid,sold_date' });
        if (!error) tablesPopulated.push('agent_transactions');
      }
    }

    // ============================================
    // Populate agent_listings
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
        const { error } = await supabase.from('agent_listings')
          .upsert(listings, { onConflict: 'zillow_zpid' });
        if (!error) tablesPopulated.push('agent_listings');
      }
    }

    // ============================================
    // Populate agent_reviews
    // ============================================
    const reviews = agentData.reviews || [];
    if (Array.isArray(reviews) && reviews.length > 0) {
      const reviewRecords = reviews
        .filter((r: any) => r.reviewId && r.rating && r.createDate)
        .slice(0, 100) // Limit to 100 reviews
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
          reviewer_first_name: r.reviewer?.firstName || null,
          reviewer_last_name: r.reviewer?.lastName || null,
          reviewer_show_name: r.reviewer?.showName || null,
          rebuttal: r.rebuttal || null,
          updated_at: new Date().toISOString()
        }));

      if (reviewRecords.length > 0) {
        const { error } = await supabase.from('agent_reviews')
          .upsert(reviewRecords, { onConflict: 'zillow_review_id' });
        if (!error) tablesPopulated.push('agent_reviews');
      }
    }

    // ============================================
    // Populate agent_team_members
    // ============================================
    if (agentData.teamDisplayInformation?.teamLeadInfo?.children) {
      const teamMembers = agentData.teamDisplayInformation.teamLeadInfo.children;
      if (Array.isArray(teamMembers) && teamMembers.length > 0) {
        const teamRecords = teamMembers.map((member: any) => ({
          team_lead_id: professionalId,
          member_id: professionalId, // Will need to link to actual member professional records later
          team_name: agentData.teamDisplayInformation.teamLeadInfo.teamName || 'Unknown Team',
          member_name: member.name || 'Unknown',
          member_screen_name: member.screenName || null,
          member_zillow_zuid: member.zuid || null,
          member_photo_url: member.profilePhotoSrc || null,
          member_review_count: member.ratings?.count || null,
          member_review_average: member.ratings?.average || null,
          member_is_top_agent: member.isTopAgent || false,
          updated_at: new Date().toISOString()
        }));

        if (teamRecords.length > 0) {
          const { error } = await supabase.from('agent_team_members')
            .upsert(teamRecords, { onConflict: 'team_lead_id,member_id' });
          if (!error) tablesPopulated.push('agent_team_members');
        }
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

    console.log(`   ✅ Created professional: ${professionalId} - Tables: ${tablesPopulated.join(', ')}`);

    return {
      id: agent.id,
      name: agent.name,
      license_number: agent.license_number,
      status: 'success',
      rating,
      reviews: reviewCount,
      professionalId,
      tablesPopulated,
      message: `Created professional record with ${tablesPopulated.length} tables populated`
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

// Helper to re-enrich an existing professional
async function reEnrichProfessional(
  professional: { id: string; name: string; zillow_profile_url: string },
  supabase: any,
  apifyToken: string,
  proxyUrl: string | null
): Promise<EnrichmentResult> {
  console.log(`🔄 Re-enriching: ${professional.name} - ${professional.zillow_profile_url}`);

  try {
    // Call Memo23 Apify actor
    const actorId = 'memo23~apify-zillow-agents-cheerio';
    const actorInput = {
      startUrls: [{ url: professional.zillow_profile_url }],
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
      return {
        id: professional.id,
        name: professional.name,
        license_number: '',
        status: 'failed',
        message: 'No data returned from Memo23'
      };
    }

    const rating = agentData.ratings?.average || 0;
    const reviewCount = agentData.ratings?.count || 0;
    console.log(`   ${professional.name}: ${rating}⭐ (${reviewCount} reviews)`);

    // Build update data with ALL memo23 fields
    const updateData: Record<string, any> = {
      review_stars_rating: rating,
      num_total_reviews: reviewCount,
      zillow_data_source: 'memo23',
      zillow_data_fetched_at: new Date().toISOString(),
      zillow_last_scraped_at: new Date().toISOString(),
      zillow_scrape_status: 'success',
    };

    // Basic fields
    if (agentData.screenName) updateData.screen_name = agentData.screenName;
    if (agentData.encodedZuid) {
      updateData.encoded_zuid = agentData.encodedZuid;
      updateData.zuid = agentData.encodedZuid;
    }
    if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;

    // Business info
    if (agentData.businessName) {
      updateData.business_name = agentData.businessName;
      updateData.company = agentData.businessName;
    }
    if (agentData.businessAddress) {
      updateData.business_address = agentData.businessAddress;
      updateData.business_city = agentData.businessAddress.city || null;
      updateData.business_state = agentData.businessAddress.state || null;
      updateData.business_zip = agentData.businessAddress.postalCode || null;
      if (agentData.businessAddress.postalCode) {
        updateData.zip_code = agentData.businessAddress.postalCode;
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

    // Ratings
    if (agentData.ratings) {
      updateData.ratings = agentData.ratings;
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
      if (agentData.agentSalesStats.averageValue) {
        updateData.average_value_3yr = agentData.agentSalesStats.averageValue || null;
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
    }

    // Active listings count
    if (agentData.forSaleCount !== undefined) {
      updateData.active_for_sale_count = agentData.forSaleCount;
    }
    if (agentData.forRentCount !== undefined) {
      updateData.active_for_rent_count = agentData.forRentCount;
    }

    // Update professionals record
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professional.id);

    if (updateError) {
      console.error(`   Failed to update professional: ${updateError.message}`);
      return {
        id: professional.id,
        name: professional.name,
        license_number: '',
        status: 'failed',
        message: `Update failed: ${updateError.message}`
      };
    }

    const tablesPopulated: string[] = ['professionals'];

    // Populate agent_licenses
    if (agentData.agentLicenses && Array.isArray(agentData.agentLicenses)) {
      const licenses = agentData.agentLicenses.map((lic: any) => ({
        professional_id: professional.id,
        license_number: lic.text || lic.licenseNumber || '',
        state: lic.state || 'AZ',
        license_type: lic.type || null,
        status: lic.status || null,
        updated_at: new Date().toISOString()
      }));

      if (licenses.length > 0) {
        const { error } = await supabase.from('agent_licenses')
          .upsert(licenses, { onConflict: 'professional_id,license_number,state' });
        if (!error) tablesPopulated.push('agent_licenses');
      }
    }

    // Populate agent_transactions (past sales)
    const pastSales = agentData.pastSales || agentData.past_sales || [];
    if (Array.isArray(pastSales) && pastSales.length > 0) {
      const transactions = pastSales
        .filter((sale: any) => sale.zpid && sale.soldDate && sale.price)
        .map((sale: any) => ({
          professional_id: professional.id,
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
        const { error } = await supabase.from('agent_transactions')
          .upsert(transactions, { onConflict: 'professional_id,zillow_zpid,sold_date' });
        if (!error) tablesPopulated.push('agent_transactions');
      }
    }

    // Populate agent_listings
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
          professional_id: professional.id,
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
        const { error } = await supabase.from('agent_listings')
          .upsert(listings, { onConflict: 'zillow_zpid' });
        if (!error) tablesPopulated.push('agent_listings');
      }
    }

    // Populate agent_reviews
    const reviews = agentData.reviews || [];
    if (Array.isArray(reviews) && reviews.length > 0) {
      const reviewRecords = reviews
        .filter((r: any) => r.reviewId && r.rating && r.createDate)
        .slice(0, 100)
        .map((r: any) => ({
          professional_id: professional.id,
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
          reviewer_first_name: r.reviewer?.firstName || null,
          reviewer_last_name: r.reviewer?.lastName || null,
          reviewer_show_name: r.reviewer?.showName || null,
          rebuttal: r.rebuttal || null,
          updated_at: new Date().toISOString()
        }));

      if (reviewRecords.length > 0) {
        const { error } = await supabase.from('agent_reviews')
          .upsert(reviewRecords, { onConflict: 'zillow_review_id' });
        if (!error) tablesPopulated.push('agent_reviews');
      }
    }

    // Populate agent_team_members
    if (agentData.teamDisplayInformation?.teamLeadInfo?.children) {
      const teamMembers = agentData.teamDisplayInformation.teamLeadInfo.children;
      if (Array.isArray(teamMembers) && teamMembers.length > 0) {
        const teamRecords = teamMembers.map((member: any) => ({
          team_lead_id: professional.id,
          member_id: professional.id,
          team_name: agentData.teamDisplayInformation.teamLeadInfo.teamName || 'Unknown Team',
          member_name: member.name || 'Unknown',
          member_screen_name: member.screenName || null,
          member_zillow_zuid: member.zuid || null,
          member_photo_url: member.profilePhotoSrc || null,
          member_review_count: member.ratings?.count || null,
          member_review_average: member.ratings?.average || null,
          member_is_top_agent: member.isTopAgent || false,
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('agent_team_members')
          .upsert(teamRecords, { onConflict: 'team_lead_id,member_id' });
        if (!error) tablesPopulated.push('agent_team_members');
      }
    }

    console.log(`   ✅ Updated ${professional.name} - ${tablesPopulated.length} tables`);

    return {
      id: professional.id,
      name: professional.name,
      license_number: '',
      status: 'success',
      rating,
      reviews: reviewCount,
      professionalId: professional.id,
      tablesPopulated,
      message: `Updated with ${tablesPopulated.length} tables populated`
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Error re-enriching ${professional.name}: ${errorMsg}`);

    return {
      id: professional.id,
      name: professional.name,
      license_number: '',
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
    const { 
      limit = 50, 
      concurrency = 5, 
      dryRun = false,
      sequential = false,
      delaySeconds = 5,
      mode = 'state_licenses', // 'state_licenses' or 'professionals'
      state = 'CA',            // State filter: 'CA', 'AZ', etc.
      stateSlug = null         // For professionals mode: 'arizona', 'california'
    } = await req.json();

    console.log(`🚀 Starting batch Memo23 enrichment`);
    console.log(`   Mode: ${mode}, State: ${state || stateSlug}`);
    console.log(`   Limit: ${limit}, Concurrency: ${concurrency}, Sequential: ${sequential}, Delay: ${delaySeconds}s, DryRun: ${dryRun}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // =========================================
    // MODE: Re-enrich existing professionals (for Arizona)
    // =========================================
    if (mode === 'professionals') {
      const targetStateSlug = stateSlug || (state === 'AZ' ? 'arizona' : 'california');
      
      const { data: professionals, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url')
        .eq('state_slug', targetStateSlug)
        .eq('active', true)
        .not('zillow_profile_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (fetchError) {
        throw new Error(`Failed to fetch professionals: ${fetchError.message}`);
      }

      if (!professionals || professionals.length === 0) {
        return new Response(JSON.stringify({
          message: `No ${targetStateSlug} professionals found with Zillow URLs`,
          processed: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`📋 Found ${professionals.length} ${targetStateSlug} professionals to re-enrich`);

      if (dryRun) {
        return new Response(JSON.stringify({
          dryRun: true,
          mode: 'professionals',
          state: targetStateSlug,
          message: `Would re-enrich ${professionals.length} professionals`,
          professionals: professionals.map(p => ({ id: p.id, name: p.name, zillow_url: p.zillow_profile_url }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (sequential) {
        console.log(`⏱️ Running in sequential mode: 1 professional every ${delaySeconds} seconds`);
        
        for (let i = 0; i < professionals.length; i++) {
          const pro = professionals[i];
          console.log(`\n📦 Processing professional ${i + 1}/${professionals.length}: ${pro.name}`);
          
          const result = await reEnrichProfessional(pro, supabase, apifyToken, proxyUrl);
          results.push(result);
          
          if (i < professionals.length - 1) {
            console.log(`   ⏳ Waiting ${delaySeconds} seconds before next...`);
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          }
        }
      } else {
        for (let i = 0; i < professionals.length; i += concurrency) {
          const batch = professionals.slice(i, i + concurrency);
          console.log(`\n📦 Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} professionals)`);

          const batchResults = await Promise.all(
            batch.map(pro => reEnrichProfessional(pro, supabase, apifyToken, proxyUrl))
          );

          results.push(...batchResults);

          if (i + concurrency < professionals.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const summary = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        mode: 'professionals',
        state: targetStateSlug,
        processingMode: sequential ? `sequential (${delaySeconds}s delay)` : `batch (concurrency: ${concurrency})`
      };

      console.log(`\n🎉 Re-enrichment complete!`);
      console.log(`   Success: ${summary.success}`);
      console.log(`   Failed: ${summary.failed}`);

      return new Response(JSON.stringify({
        message: `Re-enriched ${results.length} ${targetStateSlug} professionals`,
        summary,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================
    // MODE: Process state_licenses (original behavior)
    // =========================================
    const { data: agents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city, brokerage_name, zillow_url')
      .eq('state', state)
      .not('zillow_url', 'is', null)
      .is('zillow_scraped_at', null)
      .order('exa_searched_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({
        message: `No ${state} agents to process - all have been scraped`,
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${agents.length} ${state} agents to enrich with Memo23`);

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        mode: 'state_licenses',
        state,
        message: `Would process ${agents.length} agents`,
        agents: agents.map(a => ({ id: a.id, name: a.name, zillow_url: a.zillow_url }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sequential) {
      console.log(`⏱️ Running in sequential mode: 1 agent every ${delaySeconds} seconds`);
      
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        console.log(`\n📦 Processing agent ${i + 1}/${agents.length}: ${agent.name}`);
        
        const result = await enrichAgent(agent, supabase, apifyToken, proxyUrl);
        results.push(result);
        
        if (i < agents.length - 1) {
          console.log(`   ⏳ Waiting ${delaySeconds} seconds before next agent...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      }
    } else {
      for (let i = 0; i < agents.length; i += concurrency) {
        const batch = agents.slice(i, i + concurrency);
        console.log(`\n📦 Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} agents)`);

        const batchResults = await Promise.all(
          batch.map(agent => enrichAgent(agent, supabase, apifyToken, proxyUrl))
        );

        results.push(...batchResults);

        if (i + concurrency < agents.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      notQualified: results.filter(r => r.status === 'not_qualified').length,
      duplicate: results.filter(r => r.status === 'duplicate').length,
      failed: results.filter(r => r.status === 'failed').length,
      mode: 'state_licenses',
      state,
      processingMode: sequential ? `sequential (${delaySeconds}s delay)` : `batch (concurrency: ${concurrency})`
    };

    console.log(`\n🎉 Batch complete!`);
    console.log(`   Success: ${summary.success}`);
    console.log(`   Not Qualified: ${summary.notQualified}`);
    console.log(`   Duplicate: ${summary.duplicate}`);
    console.log(`   Failed: ${summary.failed}`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} ${state} agents`,
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