/**
 * Local script to re-enrich CA agents via Memo23/Apify.
 * Runs locally to avoid Supabase edge function timeout (~150s).
 * Each Apify run takes ~3 minutes per agent.
 *
 * Usage: node scripts/run-ca-enrichment.mjs [--dry-run] [--limit N] [--concurrency N]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const PROXY_URL = 'http://pcpqh0DDmv-res-us:PC_9kCZToNJ46ODIkij1@proxy-us.proxy-cheap.com:5959';

if (!SUPABASE_KEY) {
  // Try loading from .env
  const { readFileSync } = await import('fs');
  const envContent = readFileSync('.env', 'utf8');
  const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (match) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
  }
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apifyToken = APIFY_TOKEN || process.env.APIFY_API_TOKEN;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in env or .env file');
  process.exit(1);
}

// Fetch Apify token from Supabase edge function if not in env
let finalApifyToken = apifyToken;

const supabase = createClient(SUPABASE_URL, supabaseKey);

if (!finalApifyToken) {
  console.log('Fetching APIFY_API_TOKEN from Supabase...');
  const tokenResp = await fetch(`${SUPABASE_URL}/functions/v1/get-apify-token`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const tokenData = await tokenResp.json();
  finalApifyToken = tokenData.token;
  if (!finalApifyToken) {
    console.error('ERROR: Could not retrieve APIFY_API_TOKEN from Supabase secrets');
    process.exit(1);
  }
  console.log(`Got APIFY token (${finalApifyToken.length} chars)\n`);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 999;
const concIdx = args.indexOf('--concurrency');
const concurrency = concIdx !== -1 ? parseInt(args[concIdx + 1]) : 5;

console.log(`\n🚀 CA Agent Re-Enrichment via Memo23`);
console.log(`   Dry run: ${dryRun}`);
console.log(`   Limit: ${limit}`);
console.log(`   Concurrency: ${concurrency}`);
console.log(`   Proxy: proxy-us.proxy-cheap.com:5959\n`);

// Step 1: Get CA agents with null contact data
const { data: agents, error: fetchError } = await supabase
  .from('professionals')
  .select('id, name, zillow_profile_url, email, phone')
  .eq('state_slug', 'california')
  .eq('active', true)
  .not('zillow_profile_url', 'is', null)
  .is('email', null)
  .is('phone', null)
  .order('created_at', { ascending: true })
  .limit(limit);

if (fetchError) {
  console.error('Failed to fetch agents:', fetchError.message);
  process.exit(1);
}

console.log(`📋 Found ${agents.length} CA agents with null email AND phone\n`);

if (!agents.length) {
  console.log('Nothing to do!');
  process.exit(0);
}

if (dryRun) {
  agents.forEach((a, i) => console.log(`  ${i + 1}. ${a.name} - ${a.zillow_profile_url}`));
  console.log(`\nDry run complete. Run without --dry-run to enrich.`);
  process.exit(0);
}

// Direct Apify approach (preferred - no timeout issues)
const ACTOR_ID = 'memo23~apify-zillow-agents-cheerio';
let totalSuccess = 0, totalFailed = 0;

async function enrichAgent(agent) {
  const startTime = Date.now();
  console.log(`  ▶️ ${agent.name}...`);

  try {
    // Start Apify run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${finalApifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: agent.zillow_profile_url }],
          maxConcurrency: 5,
          maxRequestRetries: 5,
          requestHandlerTimeoutSecs: 180,
          proxyConfiguration: {
            useApifyProxy: false,
            proxyUrls: [PROXY_URL]
          }
        })
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Apify start failed: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Poll for completion (max 5 minutes)
    let attempts = 0;
    let runStatus = 'RUNNING';
    let agentData = null;

    while (attempts < 60 && runStatus === 'RUNNING') {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${finalApifyToken}`
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        runStatus = statusData.data.status;

        if (runStatus === 'SUCCEEDED') {
          const datasetId = statusData.data.defaultDatasetId;
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${finalApifyToken}`
          );
          if (datasetResponse.ok) {
            const results = await datasetResponse.json();
            if (results?.length > 0) agentData = results[0];
          }
        } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
          throw new Error(`Apify run ${runStatus}`);
        }
      }
      attempts++;
    }

    if (!agentData) {
      throw new Error('No data returned from Apify');
    }

    // Build update data (matching batch-memo23-ca-enrich reEnrichProfessional)
    const rating = agentData.ratings?.average || agentData.rating || null;
    const reviewCount = agentData.ratings?.count || agentData.reviewCount || null;

    const updateData = {
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

    // Email
    if (agentData.email) updateData.email = agentData.email;

    // Website & languages from professionalInformation
    if (agentData.professionalInformation) {
      updateData.professional_information = agentData.professionalInformation;
      if (Array.isArray(agentData.professionalInformation)) {
        for (const info of agentData.professionalInformation) {
          if (info.websites?.length > 0) {
            updateData.website = info.websites[0].url || info.websites[0];
          }
          if (info.languages?.length > 0) {
            updateData.languages = info.languages;
          }
        }
      }
    }

    // Bio
    if (agentData.getToKnowMe) updateData.get_to_know_me = agentData.getToKnowMe;

    // Status flags
    if (agentData.isTopAgent !== undefined) updateData.is_top_agent = agentData.isTopAgent;
    if (agentData.isPremierAgent !== undefined) updateData.is_premier_agent = agentData.isPremierAgent;
    if (agentData.inCanada !== undefined) updateData.in_canada = agentData.inCanada;

    // Video
    if (agentData.sidebarVideoUrl) updateData.sidebar_video_url = agentData.sidebarVideoUrl;

    // Profile metadata
    if (agentData.flag) updateData.zillow_flag = agentData.flag;
    if (agentData.profileImageId) updateData.profile_image_id = agentData.profileImageId;
    if (agentData.profileTypeIds) updateData.profile_type_ids = agentData.profileTypeIds;
    if (agentData.profileTypes) updateData.profile_types = agentData.profileTypes;
    if (agentData.cpdUserPronouns) updateData.cpd_user_pronouns = agentData.cpdUserPronouns;

    // Reviews data blob
    if (agentData.reviewsData) updateData.reviews_data = agentData.reviewsData;

    // Preferred lenders
    if (agentData.preferredLenders) updateData.professional_data = { preferredLenders: agentData.preferredLenders };

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
      if (agentData.businessAddress.postalCode) updateData.zip_code = agentData.businessAddress.postalCode;
    }

    // Phone numbers - put first available in main phone field, only use cell_phone if explicitly cell
    if (agentData.phoneNumbers) {
      updateData.phone_numbers = agentData.phoneNumbers;
      // Main phone: use business or first available number
      if (agentData.phoneNumbers.business) {
        updateData.phone = agentData.phoneNumbers.business;
      } else if (agentData.phoneNumbers.cell) {
        updateData.phone = agentData.phoneNumbers.cell;
      }
      // Only populate cell_phone if explicitly a cell number
      if (agentData.phoneNumbers.cell) {
        updateData.cell_phone = agentData.phoneNumbers.cell;
      }
    }

    // Ratings blob
    if (agentData.ratings) updateData.ratings = agentData.ratings;

    // Sales stats
    if (agentData.agentSalesStats) {
      updateData.agent_sales_stats = agentData.agentSalesStats;
      updateData.sales_count_all_time = agentData.agentSalesStats.countAllTime || null;
      updateData.sales_count_last_year = agentData.agentSalesStats.countLastYear || null;
      if (agentData.agentSalesStats.priceRangeThreeYearMin !== undefined) {
        updateData.price_range_3yr_min = agentData.agentSalesStats.priceRangeThreeYearMin;
      }
      if (agentData.agentSalesStats.priceRangeThreeYearMax !== undefined) {
        updateData.price_range_3yr_max = agentData.agentSalesStats.priceRangeThreeYearMax;
      }
      if (agentData.agentSalesStats.averageValueThreeYear !== undefined) {
        updateData.average_value_3yr = agentData.agentSalesStats.averageValueThreeYear;
      }
      updateData.stats_include_team = agentData.agentSalesStats.stats_include_team || false;
    }

    // Team detection
    if (agentData.teamDisplayInformation) {
      updateData.team_display_information = agentData.teamDisplayInformation;
    }

    // Licenses
    if (agentData.agentLicenses) updateData.agent_licenses = agentData.agentLicenses;

    // Listings count
    if (agentData.forSaleListings?.listing_count !== undefined) {
      updateData.active_for_sale_count = agentData.forSaleListings.listing_count;
    } else if (agentData.forSaleCount !== undefined) {
      updateData.active_for_sale_count = agentData.forSaleCount;
    }
    if (agentData.forRentListings?.listing_count !== undefined) {
      updateData.active_for_rent_count = agentData.forRentListings.listing_count;
    } else if (agentData.forRentCount !== undefined) {
      updateData.active_for_rent_count = agentData.forRentCount;
    }

    // Past sales total
    if (agentData.pastSales?.total !== undefined) {
      updateData.total_sales = agentData.pastSales.total;
    }

    // Update DB
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', agent.id);

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    // Also upsert reviews if available
    const reviews = agentData.reviews || [];
    if (Array.isArray(reviews) && reviews.length > 0) {
      const reviewRecords = reviews
        .filter(r => r.reviewId && r.rating && r.createDate)
        .slice(0, 100)
        .map(r => ({
          professional_id: agent.id,
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
        await supabase.from('agent_reviews')
          .upsert(reviewRecords, { onConflict: 'zillow_review_id' });
      }
    }

    // Upsert past sales/transactions
    const pastSales = agentData.pastSales?.sales || [];
    if (Array.isArray(pastSales) && pastSales.length > 0) {
      const transactions = pastSales
        .filter(s => s.zpid && s.soldDate && s.price)
        .map(s => ({
          professional_id: agent.id,
          zillow_zpid: parseInt(s.zpid, 10),
          represented_list: JSON.stringify(s.represented || ['buyer']),
          sold_date: s.soldDate,
          price: parseInt(s.price, 10),
          street_address: s.address?.streetAddress || null,
          city: s.address?.city || null,
          state: s.address?.state || null,
          zip_code: s.address?.zipcode || null,
          bedrooms: s.bedrooms || null,
          bathrooms: s.bathrooms || null,
          living_area_sqft: s.livingArea || null,
          image_url: s.imgSrc || null,
          home_details_url: s.detailUrl || null,
          updated_at: new Date().toISOString()
        }));

      if (transactions.length > 0) {
        await supabase.from('agent_transactions')
          .upsert(transactions, { onConflict: 'professional_id,zillow_zpid,sold_date' });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const contactInfo = [
      agentData.email ? `email: ${agentData.email}` : null,
      agentData.phoneNumbers?.business ? `phone: ${agentData.phoneNumbers.business}` : agentData.phoneNumbers?.cell ? `phone(cell): ${agentData.phoneNumbers.cell}` : null,
    ].filter(Boolean).join(', ');

    console.log(`  ✅ ${agent.name} (${elapsed}s) - ${contactInfo || 'no contact data found'}`);
    return true;
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ❌ ${agent.name} (${elapsed}s) - ${err.message}`);
    return false;
  }
}

// Process in batches
for (let i = 0; i < agents.length; i += concurrency) {
  const batch = agents.slice(i, i + concurrency);
  const batchNum = Math.floor(i / concurrency) + 1;
  const totalBatches = Math.ceil(agents.length / concurrency);

  console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} agents)`);

  const results = await Promise.all(batch.map(enrichAgent));
  totalSuccess += results.filter(Boolean).length;
  totalFailed += results.filter(r => !r).length;

  console.log(`   Running total: ${totalSuccess} success, ${totalFailed} failed`);

  if (i + concurrency < agents.length) {
    console.log(`   ⏳ 3s pause before next batch...`);
    await new Promise(r => setTimeout(r, 3000));
  }
}

console.log(`\n🎉 CA Re-Enrichment Complete!`);
console.log(`   Total: ${agents.length}`);
console.log(`   Success: ${totalSuccess}`);
console.log(`   Failed: ${totalFailed}`);
