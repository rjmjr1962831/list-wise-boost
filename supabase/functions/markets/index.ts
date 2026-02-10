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
    const state = url.searchParams.get('state')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let query = supabase
      .from('professionals')
      .select('state, state_slug, city, city_slug')
      .eq('active', true)

    if (state) {
      query = query.ilike('state', `%${state}%`)
    }

    const { data: citiesData, error: citiesError } = await query

    if (citiesError) {
      console.error('Cities query error:', citiesError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve markets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by state and city
    const statesMap = new Map()
    const cityCountsMap = new Map()

    citiesData.forEach(row => {
      const stateKey = row.state
      const cityKey = `${row.state}:${row.city}`

      if (!statesMap.has(stateKey)) {
        statesMap.set(stateKey, {
          state: row.state,
          state_slug: row.state_slug,
          cities: new Map()
        })
      }

      const stateData = statesMap.get(stateKey)
      if (!stateData.cities.has(cityKey)) {
        stateData.cities.set(cityKey, {
          city: row.city,
          city_slug: row.city_slug,
          agent_count: 0,
          url: `https://www.top10lists.us/${row.state_slug}/${row.city_slug}/top10realestateagents`
        })
      }

      cityCountsMap.set(cityKey, (cityCountsMap.get(cityKey) || 0) + 1)
    })

    // Apply counts
    statesMap.forEach(stateData => {
      stateData.cities.forEach((cityData, cityKey) => {
        cityData.agent_count = cityCountsMap.get(cityKey) || 0
      })
    })

    // Format output
    const states = Array.from(statesMap.values()).map(state => {
      const cities = Array.from(state.cities.values())
      const agentCount = cities.reduce((sum, city) => sum + city.agent_count, 0)
      
      return {
        state: state.state,
        state_slug: state.state_slug,
        agent_count: agentCount,
        cities
      }
    })

    const totalAgents = citiesData.length
    const totalCities = Array.from(statesMap.values())
      .reduce((sum, state) => sum + state.cities.size, 0)

    const response = {
      states,
      summary: {
        total_states: states.length,
        total_cities: totalCities,
        total_agents: totalAgents
      },
      last_updated: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        } 
      }
    )

  } catch (error) {
    console.error('Markets API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
