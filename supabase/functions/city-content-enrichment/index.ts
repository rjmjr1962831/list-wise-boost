import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEEPSEEK_API_KEY = 'REDACTED_DEEPSEEK_KEY'
const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODA4NzM2OSwiZXhwIjoyMDUzNjYzMzY5fQ.VMloBHdsK6bCBfUMxDGY0WqiKHFRJauWfvj10bKK5W4'
const BATCH_SIZE = 5

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
    
    // Clean JSON
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get all existing marketing content pages (with pagination)
    const existingPages = new Set<string>()
    let offset = 0
    while (true) {
      const { data: contentPages } = await supabase
        .from('marketing_content')
        .select('page')
        .ilike('page', 'city-%')
        .eq('section', 'market_overview')
        .range(offset, offset + 999)
      
      if (!contentPages || contentPages.length === 0) break
      contentPages.forEach(p => existingPages.add(p.page))
      if (contentPages.length < 1000) break
      offset += 1000
    }

    // Get cities needing content (AZ and CA only)
    const citiesNeedingContent: City[] = []
    
    for (const state of ['Arizona', 'California']) {
      let cityOffset = 0
      while (citiesNeedingContent.length < BATCH_SIZE) {
        const { data: cities } = await supabase
          .from('cities')
          .select('id, name, state, slug')
          .eq('state', state)
          .eq('active', true)
          .order('name')
          .range(cityOffset, cityOffset + 999)
        
        if (!cities || cities.length === 0) break
        
        for (const city of cities) {
          if (!existingPages.has(`city-${city.slug}`)) {
            citiesNeedingContent.push(city)
            if (citiesNeedingContent.length >= BATCH_SIZE) break
          }
        }
        
        if (cities.length < 1000) break
        cityOffset += 1000
      }
      
      if (citiesNeedingContent.length >= BATCH_SIZE) break
    }

    if (citiesNeedingContent.length === 0) {
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'All AZ and CA cities have content',
        existingPages: existingPages.size
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process batch
    const results: Array<{city: string, status: string, error?: string}> = []

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
          results.push({ city: city.name, status: 'error', error: upsertError.message })
        } else {
          results.push({ city: city.name, status: 'success' })
        }
      } else {
        results.push({ city: city.name, status: 'failed', error: 'Content generation failed' })
      }

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const elapsed = Date.now() - startTime

    return new Response(JSON.stringify({
      status: 'processing',
      processed: results,
      batchSize: BATCH_SIZE,
      elapsedMs: elapsed,
      message: 'Cron will trigger next batch'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
