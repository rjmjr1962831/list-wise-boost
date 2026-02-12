import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? ''
const MEMO23_ACTOR_ID = 'memo23/apify-zillow-agents-cheerio'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get agents needing enrichment
    const { data: agents, error: fetchError } = await supabaseClient
      .from('professionals')
      .select('id, name, zillow_profile_url')
      .gte('review_stars_rating', 4.0)
      .lt('review_stars_rating', 4.8)
      .gte('num_total_reviews', 20)
      .is('zillow_data_fetched_at', null)
      .limit(10) // Process 10 at a time

    if (fetchError) throw fetchError
    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ message: 'No agents to enrich' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`Processing ${agents.length} agents`)

    const results = []
    
    for (const agent of agents) {
      try {
        // Call Apify memo23
        const apifyResponse = await fetch(
          `https://api.apify.com/v2/acts/${MEMO23_ACTOR_ID}/run-sync-get-dataset-items`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${APIFY_TOKEN}`
            },
            body: JSON.stringify({
              startUrls: [{ url: agent.zillow_profile_url }],
              maxItems: 1,
              proxy: {
                useApifyProxy: false,
                proxyUrls: [
                  'http://ws1et3ycrlwml6w:fyg90v72ru9t1xq@rp.scrapegw.com:6060'
                ]
              }
            })
          }
        )

        if (!apifyResponse.ok) {
          console.error(`Apify error for ${agent.name}: ${apifyResponse.status}`)
          continue
        }

        const apifyData = await apifyResponse.json()
        const zillowData = apifyData[0] || {}

        // Extract ALL data from memo23 response
        const updateData = {
          // Profile basics
          encoded_zuid: zillowData.encodedZuid || null,
          screen_name: zillowData.screenName || null,
          business_name: zillowData.businessName || null,
          
          // Contact info
          phone_numbers: zillowData.phoneNumbers || null,
          email: zillowData.email || null,
          website: zillowData.website || null,
          
          // Address data
          business_address: zillowData.address || null,
          business_city: zillowData.city || null,
          business_state: zillowData.state || null,
          business_zip: zillowData.zipCode || null,
          
          // Professional info
          years_experience: zillowData.yearsOfExperience || null,
          specialties: zillowData.specialties || null,
          languages: zillowData.languages || null,
          certifications: zillowData.certifications || null,
          
          // Stats
          num_total_reviews: zillowData.reviewCount || null,
          review_stars_rating: zillowData.rating || null,
          sales_count_last_year: zillowData.salesLast12Months || null,
          sales_count_all_time: zillowData.transactionCount || null,
          
          // Pricing data
          price_range_3yr_min: zillowData.priceRangeMin || null,
          price_range_3yr_max: zillowData.priceRangeMax || null,
          average_value_3yr: zillowData.averagePrice || null,
          
          // Profile data
          get_to_know_me: zillowData.biography || null,
          profile_image_id: zillowData.photoUrl || null,
          
          // Reviews
          reviews_data: zillowData.reviews ? { external_reviews: zillowData.reviews } : null,
          
          // Listings
          active_for_sale_count: zillowData.activeForSaleCount || 0,
          active_for_rent_count: zillowData.activeForRentCount || 0,
          
          // Past sales (transaction history)
          past_sales: zillowData.transactionHistory || null,
          
          // Social
          social_facebook: zillowData.facebookUrl || null,
          social_linkedin: zillowData.linkedinUrl || null,
          social_instagram: zillowData.instagramUrl || null,
          social_twitter: zillowData.twitterUrl || null,
          
          // Metadata
          zillow_data_fetched_at: new Date().toISOString(),
          zillow_data_source: 'memo23',
          raw_scraper_data: zillowData
        }

        // Update database
        const { error: updateError } = await supabaseClient
          .from('professionals')
          .update(updateData)
          .eq('id', agent.id)

        if (updateError) {
          console.error(`Update error for ${agent.name}:`, updateError)
          results.push({ id: agent.id, name: agent.name, status: 'error', error: updateError.message })
        } else {
          results.push({ id: agent.id, name: agent.name, status: 'success' })
        }

      } catch (err) {
        console.error(`Error processing ${agent.name}:`, err)
        results.push({ id: agent.id, name: agent.name, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({
      processed: agents.length,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
