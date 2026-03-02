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
    const params = url.searchParams

    const state = params.get('state')
    const city = params.get('city')
    const zip = params.get('zip')
    const neighborhood = params.get('neighborhood')
    const specialty = params.get('specialty')
    const minRating = parseFloat(params.get('min_rating') || '4.5')
    const minReviews = parseInt(params.get('min_reviews') || '10')
    const hasCertification = params.get('has_certification') === 'true'
    const limit = Math.min(parseInt(params.get('limit') || '10'), 50)
    const offset = parseInt(params.get('offset') || '0')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const startTime = Date.now()

    let query = supabase
      .from('professionals')
      .select(`
        id,
        name,
        company,
        profile_shortcode,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        license_number,
        city,
        state,
        zip_code,
        specialties,
        phone,
        email,
        website
      `, { count: 'exact' })
      .eq('active', true)
      .gte('review_stars_rating', minRating)
      .gte('num_total_reviews', minReviews)

    if (state) query = query.ilike('state', `%${state}%`)
    if (city) query = query.ilike('city', `%${city}%`)
    if (zip) query = query.eq('zip_code', zip)
    if (specialty) query = query.contains('specialties', [specialty])

    query = query
      .order('review_stars_rating', { ascending: false })
      .order('num_total_reviews', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database query failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = (data || []).map(agent => ({
      agent_id: agent.id,
      name: agent.name,
      company: agent.company,
      profile_url: `https://www.top10lists.us/p/${agent.profile_shortcode}`,
      
      qualifications: {
        rating: agent.review_stars_rating,
        review_count: agent.num_total_reviews,
        years_experience: agent.years_experience,
        license_number: agent.license_number,
        license_verified: !!agent.license_number
      },
      
      markets: {
        city: agent.city,
        state: agent.state,
        zip: agent.zip_code
      },
      
      specialties: agent.specialties || [],
      
      contact: {
        phone: agent.phone,
        email: agent.email,
        website: agent.website
      }
    }))

    const queryTime = Date.now() - startTime

    const response = {
      results,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (count || 0)
      },
      filters_applied: {
        state,
        city,
        zip,
        neighborhood,
        specialty,
        min_rating: minRating,
        min_reviews: minReviews,
        has_certification: hasCertification
      },
      query_time_ms: queryTime
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        } 
      }
    )

  } catch (error) {
    console.error('Search API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
