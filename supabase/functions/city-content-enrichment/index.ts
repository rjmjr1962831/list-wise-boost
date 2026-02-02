import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || 'REDACTED_DEEPSEEK_KEY'
const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODA4NzM2OSwiZXhwIjoyMDUzNjYzMzY5fQ.VMloBHdsK6bCBfUMxDGY0WqiKHFRJauWfvj10bKK5W4'
const BATCH_SIZE = 5

interface City {
  id: string
  name: string
  state: string
  slug: string
}

interface MarketContent {
  overview: string
  historicalFacts: string[]
  pointsOfInterest: string[]
  localCulture: string
  highlights: string[]
  buyerProfile: string
  marketTrends: string
  bestKeptSecret: string
  marketStats: {
    population: number
    medianHomePrice: number
    medianRent: number
    medianHouseholdIncome: number
    daysOnMarket: number
    pricePerSqFt: number
    yearOverYearChange: number
    inventoryLevel: string
    marketType: string
    averageHomeSize: number
    homeownershipRate: number
    rentToIncomeRatio: number
    rentalVacancyRate: number
    pctRenterOccupied: number
  }
  metadata: {
    marketStatsUpdatedAt: string
    generatedBy: string
  }
}

async function generateCityContent(city: City): Promise<MarketContent | null> {
  const prompt = `You are a real estate market analyst. Generate comprehensive market content for ${city.name}, ${city.state}.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "overview": "2-3 paragraph overview of the city, its character, and real estate market",
  "historicalFacts": ["3 specific historical facts about the city's founding and development"],
  "pointsOfInterest": ["6 local attractions, parks, landmarks with descriptions"],
  "localCulture": "Paragraph describing local culture, lifestyle, community character",
  "highlights": ["4 key reasons people move here"],
  "buyerProfile": "Paragraph describing typical buyers in this market",
  "marketTrends": "Paragraph on current market conditions, pricing trends, inventory",
  "bestKeptSecret": "One insider tip locals know",
  "marketStats": {
    "population": number,
    "medianHomePrice": number,
    "medianRent": number,
    "medianHouseholdIncome": number,
    "daysOnMarket": number,
    "pricePerSqFt": number,
    "yearOverYearChange": decimal between -0.2 and 0.2,
    "inventoryLevel": "Low" or "Moderate" or "High",
    "marketType": "Seller's Market" or "Balanced" or "Buyer's Market",
    "averageHomeSize": number in sqft,
    "homeownershipRate": decimal between 0.4 and 0.95,
    "rentToIncomeRatio": decimal between 0.2 and 0.4,
    "rentalVacancyRate": decimal between 0.02 and 0.12,
    "pctRenterOccupied": decimal between 0.1 and 0.6
  },
  "metadata": {
    "marketStatsUpdatedAt": "${new Date().toISOString()}",
    "generatedBy": "DeepSeek"
  }
}

Use realistic market data for ${city.state}. Be specific to ${city.name}, not generic. No em dashes.`

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
      console.error(`DeepSeek API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('No content in DeepSeek response')
      return null
    }

    // Clean and parse JSON
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const parsed = JSON.parse(jsonStr) as MarketContent
    return parsed
  } catch (error) {
    console.error(`Error generating content for ${city.name}:`, error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get cities needing enrichment (AZ and CA only, active, no marketing content yet)
    const { data: allCities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, state, slug')
      .in('state', ['Arizona', 'California'])
      .eq('active', true)
      .order('state', { ascending: true })
      .order('name', { ascending: true })

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`)
    }

    // Get existing marketing content pages
    const { data: existingContent, error: contentError } = await supabase
      .from('marketing_content')
      .select('page')
      .like('page', 'city-%')
      .eq('section', 'market_overview')

    if (contentError) {
      throw new Error(`Failed to fetch existing content: ${contentError.message}`)
    }

    const existingPages = new Set(existingContent?.map(c => c.page) || [])

    // Filter to cities without content
    const citiesNeedingContent = (allCities || []).filter(city => {
      const pageName = `city-${city.slug}`
      return !existingPages.has(pageName)
    })

    if (citiesNeedingContent.length === 0) {
      // Check if we should unschedule the cron
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'All AZ and CA cities have content',
        totalCities: allCities?.length || 0,
        citiesWithContent: existingPages.size
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process batch
    const batch = citiesNeedingContent.slice(0, BATCH_SIZE)
    const results = []

    for (const city of batch) {
      console.log(`Processing: ${city.name}, ${city.state}`)
      
      const content = await generateCityContent(city)
      
      if (content) {
        // Upsert to marketing_content
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
          console.error(`Failed to save content for ${city.name}:`, upsertError)
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

    const remaining = citiesNeedingContent.length - BATCH_SIZE

    return new Response(JSON.stringify({
      status: 'processing',
      processed: results,
      remaining: Math.max(0, remaining),
      totalNeedingContent: citiesNeedingContent.length,
      batchSize: BATCH_SIZE
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
