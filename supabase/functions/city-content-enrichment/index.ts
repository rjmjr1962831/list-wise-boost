import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
}

const DEEPSEEK_API_KEY = 'REDACTED_DEEPSEEK_KEY'
const BATCH_SIZE = 2

interface City {
  id: string
  name: string
  state: string
  slug: string
}

async function generateCityContent(city: City): Promise<object | null> {
  const prompt = `Generate real estate market content for ${city.name}, ${city.state} as JSON:
{"overview":"2-3 paragraphs about the city and real estate market","historicalFacts":["fact1","fact2","fact3"],"pointsOfInterest":["poi1 with description","poi2","poi3","poi4","poi5","poi6"],"localCulture":"paragraph on lifestyle and community","highlights":["reason1","reason2","reason3","reason4"],"buyerProfile":"paragraph on typical buyers","marketTrends":"paragraph on current market","bestKeptSecret":"insider tip","marketStats":{"population":number,"medianHomePrice":number,"medianRent":number,"medianHouseholdIncome":number,"daysOnMarket":number,"pricePerSqFt":number,"yearOverYearChange":decimal,"inventoryLevel":"Low/Moderate/High","marketType":"Seller's Market/Balanced/Buyer's Market","averageHomeSize":number,"homeownershipRate":decimal,"rentToIncomeRatio":decimal,"rentalVacancyRate":decimal,"pctRenterOccupied":decimal},"metadata":{"marketStatsUpdatedAt":"${new Date().toISOString()}","generatedBy":"DeepSeek"}}
Be specific to ${city.name}. Use realistic ${city.state} market data. No em dashes. Return ONLY valid JSON.`

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000
      })
    })

    if (!response.ok) {
      console.error(`DeepSeek error: ${response.status}`)
      return null
    }

    const data = await response.json()
    let content = data.choices?.[0]?.message?.content || ''
    
    content = content.trim()
    if (content.startsWith('```json')) content = content.slice(7)
    if (content.startsWith('```')) content = content.slice(3)
    if (content.endsWith('```')) content = content.slice(0, -3)
    content = content.trim()

    return JSON.parse(content)
  } catch (error) {
    console.error(`Error generating content for ${city.name}:`, error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const citiesNeedingContent: City[] = []
    
    for (const state of ['Arizona', 'California']) {
      if (citiesNeedingContent.length >= BATCH_SIZE) break
      
      let offset = 0
      const PAGE_SIZE = 200
      
      // Paginate through ALL cities until we find enough without content
      while (citiesNeedingContent.length < BATCH_SIZE) {
        const { data: cities, error: cityError } = await supabase
          .from('cities')
          .select('id, name, state, slug')
          .eq('state', state)
          .eq('active', true)
          .order('name')
          .range(offset, offset + PAGE_SIZE - 1)
        
        if (cityError || !cities || cities.length === 0) {
          console.log(`No more ${state} cities at offset ${offset}`)
          break
        }
        
        console.log(`Checking ${state} cities ${offset} to ${offset + cities.length}`)
        
        // Check which cities have content
        const slugsToCheck = cities.map(c => `city-${c.slug}`)
        
        const { data: existingContent } = await supabase
          .from('marketing_content')
          .select('page')
          .in('page', slugsToCheck)
          .eq('section', 'market_overview')
        
        const existingPages = new Set((existingContent || []).map(e => e.page))
        
        for (const city of cities) {
          if (!existingPages.has(`city-${city.slug}`)) {
            citiesNeedingContent.push(city)
            console.log(`Found: ${city.name} needs content`)
            if (citiesNeedingContent.length >= BATCH_SIZE) break
          }
        }
        
        // Move to next page
        offset += PAGE_SIZE
        
        // Safety: don't loop forever
        if (offset > 5000) {
          console.log('Safety limit reached')
          break
        }
      }
    }

    if (citiesNeedingContent.length === 0) {
      const { count } = await supabase
        .from('marketing_content')
        .select('*', { count: 'exact', head: true })
        .ilike('page', 'city-%')
        .eq('section', 'market_overview')
      
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'All AZ and CA active cities have content',
        existingPages: count || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process batch
    const results: Array<{city: string, state: string, status: string, error?: string}> = []

    for (const city of citiesNeedingContent) {
      console.log(`Processing: ${city.name}, ${city.state}`)
      
      const content = await generateCityContent(city)
      
      if (content) {
        const { error: upsertError } = await supabase
          .from('marketing_content')
          .upsert({
            page: `city-${city.slug}`,
            section: 'market_overview',
            key: 'full_content',
            type: 'json',
            value: JSON.stringify(content),
            active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'page,section,key'
          })

        if (upsertError) {
          console.error(`Upsert error for ${city.name}:`, upsertError)
          results.push({ city: city.name, state: city.state, status: 'error', error: upsertError.message })
        } else {
          results.push({ city: city.name, state: city.state, status: 'success' })
        }
      } else {
        results.push({ city: city.name, state: city.state, status: 'failed', error: 'Content generation failed' })
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    const elapsed = Date.now() - startTime

    return new Response(JSON.stringify({
      status: 'processing',
      processed: results,
      batchSize: BATCH_SIZE,
      elapsedMs: elapsed,
      message: 'Batch complete. Cron will trigger next batch.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    const err = error instanceof Error ? error : new Error(String(error))
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
