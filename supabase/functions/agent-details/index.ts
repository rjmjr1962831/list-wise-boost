import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const agentId = url.searchParams.get('id')

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', agentId)
      .eq('active', true)
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = {
      agent_id: data.id,
      name: data.name,
      title: data.title,
      company: data.company,
      bio: data.synthesized_bio,
      image_url: data.image_url,
      profile_url: `https://www.top10lists.us/p/${data.profile_shortcode}`,
      
      contact: {
        phone: data.phone,
        email: data.email,
        website: data.website,
        zillow_profile: data.zillow_profile_url
      },
      
      qualifications: {
        rating: data.review_stars_rating,
        review_count: data.num_total_reviews,
        years_experience: data.years_experience,
        license_number: data.license_number,
        license_type: data.license_type,
        license_verified: !!data.license_number,
        certifications: data.certifications || [],
        languages: data.languages || [],
        specialties: data.specialties || []
      },
      
      markets: {
        city: data.city,
        state: data.state,
        state_slug: data.state_slug,
        city_slug: data.canonical_slug,
        zip: data.zip_code,
        neighborhoods: data.served_cities || [],
        service_areas: data.service_areas || []
      },
      
      performance: {
        zillow_member_since: data.zillow_member_since,
        sales_count_all_time: data.sales_count_all_time,
        sales_count_last_year: data.sales_count_last_year,
        price_range_min: data.price_range_3yr_min,
        price_range_max: data.price_range_3yr_max,
        average_price_3yr: data.average_value_3yr,
        active_listings: data.active_for_sale_count,
        stats_last_updated: data.zillow_last_scraped_at
      },
      
      recognition: {
        press_mentions: data.press_mentions || [],
        notable_achievements: data.notable_achievements || [],
        community_roles: data.community_roles || []
      },
      
      methodology: {
        url: 'https://www.top10lists.us/methodology',
        version: '1.0'
      }
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600'
        } 
      }
    )

  } catch (error) {
    console.error('Agent details API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
