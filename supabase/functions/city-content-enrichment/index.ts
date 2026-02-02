// City Content Enrichment Edge Function
// Uses DeepSeek for Main tier cities, Claude Sonnet for Prime/Luxury
// Self-chains to process all cities autonomously

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
}

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const ENRICHMENT_KEY = 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'

const BATCH_SIZE = 5

interface City {
  id: string
  name: string
  slug: string
  state: string
  state_slug: string
}

interface Neighborhood {
  tier: string
}

async function getCityTier(supabase: any, cityName: string, state: string): Promise<string> {
  // Get highest tier from neighborhoods in this city
  const { data: neighborhoods } = await supabase
    .from('neighborhood_catalog')
    .select('tier')
    .eq('city_area', cityName)
    .eq('state', state)
    .limit(100)

  if (!neighborhoods || neighborhoods.length === 0) {
    return 'Main'
  }

  // Return highest tier found
  const tiers = neighborhoods.map((n: Neighborhood) => n.tier)
  if (tiers.includes('Luxury')) return 'Luxury'
  if (tiers.includes('Prime')) return 'Prime'
  return 'Main'
}

async function generateWithDeepSeek(cityName: string, state: string): Promise<string> {
  const prompt = `Write a concise, informative market overview for ${cityName}, ${state} for a real estate website. 

Include:
- Brief description of the area and its character
- Real estate market highlights
- Key neighborhoods or districts
- What makes this area attractive to homebuyers

Keep it to 2-3 paragraphs, professional tone, no fluff. Do not use markdown formatting.`

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    })
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function generateWithSonnet(cityName: string, state: string): Promise<string> {
  const prompt = `Write a sophisticated, informative market overview for ${cityName}, ${state} for a premium real estate website.

Include:
- Description of the area's character, prestige, and lifestyle
- Real estate market insights including price trends and demand
- Notable neighborhoods, luxury enclaves, or sought-after districts
- What makes this area attractive to discerning homebuyers and investors

Keep it to 3-4 paragraphs, refined professional tone. Do not use markdown formatting.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

async function getCitiesWithoutContent(supabase: any, states: string[], limit: number, offset: number): Promise<City[]> {
  // Get cities from specified states
  const { data: cities, error } = await supabase
    .from('cities')
    .select('id, name, slug, state, state_slug')
    .in('state', states)
    .eq('active', true)
    .order('state')
    .order('name')
    .range(offset, offset + limit - 1)

  if (error || !cities) return []

  // Filter to only cities without marketing content
  const citiesWithoutContent: City[] = []
  
  for (const city of cities) {
    const { data: content } = await supabase
      .from('marketing_content')
      .select('id')
      .eq('page', `city-${city.slug}`)
      .limit(1)

    if (!content || content.length === 0) {
      citiesWithoutContent.push(city)
    }

    // Stop once we have enough
    if (citiesWithoutContent.length >= BATCH_SIZE) break
  }

  return citiesWithoutContent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authKey = req.headers.get('x-enrichment-key')
    if (authKey !== ENRICHMENT_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get parameters
    const url = new URL(req.url)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const states = (url.searchParams.get('states') || 'Arizona,California').split(',')
    const dryRun = url.searchParams.get('dry_run') === 'true'

    console.log(`Starting city enrichment: offset=${offset}, states=${states.join(',')}, dryRun=${dryRun}`)

    // Get cities without content
    const cities = await getCitiesWithoutContent(supabase, states, 100, offset)

    if (cities.length === 0) {
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'No more cities to process',
        offset
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process batch
    const results = {
      processed: 0,
      deepseek: 0,
      sonnet: 0,
      errors: 0,
      cities: [] as string[]
    }

    for (const city of cities.slice(0, BATCH_SIZE)) {
      try {
        // Determine tier
        const tier = await getCityTier(supabase, city.name, city.state)
        
        // Generate content based on tier
        let content: string
        if (tier === 'Main') {
          content = await generateWithDeepSeek(city.name, city.state)
          results.deepseek++
        } else {
          content = await generateWithSonnet(city.name, city.state)
          results.sonnet++
        }

        if (!content || content.length < 100) {
          console.error(`Empty or short content for ${city.name}`)
          results.errors++
          continue
        }

        if (!dryRun) {
          // Save to marketing_content
          const { error: insertError } = await supabase
            .from('marketing_content')
            .upsert({
              page: `city-${city.slug}`,
              section: 'market_overview',
              key: 'full_content',
              type: 'text',
              value: content
            }, {
              onConflict: 'page,section,key'
            })

          if (insertError) {
            console.error(`Error saving ${city.name}: ${insertError.message}`)
            results.errors++
            continue
          }
        }

        results.processed++
        results.cities.push(`${city.name} (${tier})`)
        console.log(`Processed: ${city.name}, ${city.state} - ${tier}`)

      } catch (err) {
        console.error(`Error processing ${city.name}: ${err}`)
        results.errors++
      }
    }

    // Self-chain if more work remains
    const shouldContinue = cities.length >= BATCH_SIZE && !dryRun
    
    if (shouldContinue) {
      // Calculate new offset - we need to scan further since we checked 100 but only processed BATCH_SIZE
      const newOffset = offset + 100
      
      const selfUrl = `${SUPABASE_URL}/functions/v1/city-content-enrichment?offset=${newOffset}&states=${states.join(',')}`
      
      // Fire and forget - don't await
      fetch(selfUrl, {
        method: 'POST',
        headers: {
          'x-enrichment-key': ENRICHMENT_KEY,
          'Content-Type': 'application/json'
        }
      }).catch(err => console.error('Self-chain error:', err))

      console.log(`Chaining to offset ${newOffset}`)
    }

    return new Response(JSON.stringify({
      status: shouldContinue ? 'continuing' : 'batch_complete',
      offset,
      next_offset: shouldContinue ? offset + 100 : null,
      results,
      dry_run: dryRun
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
