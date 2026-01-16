import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cityName, citySlug, stateName = 'Arizona', stateAbbrev = 'AZ', regenerate } = await req.json();
    
    if (!cityName || !citySlug) {
      return new Response(JSON.stringify({ error: 'cityName and citySlug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have generated content for this city
    if (!regenerate) {
      const { data: existing } = await supabase
        .from('marketing_content')
        .select('value')
        .eq('page', `city-${citySlug}`)
        .eq('section', 'market_overview_enhanced')
        .eq('key', 'full_content')
        .single();

      if (existing?.value) {
        console.log(`Using cached enhanced content for ${cityName}, ${stateAbbrev}`);
        return new Response(JSON.stringify({ content: JSON.parse(existing.value), cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate unique content using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get regional context based on state
    const regionContext = getRegionContext(cityName, stateName);

    const prompt = `Generate comprehensive real estate content for ${cityName}, ${stateName} including BOTH narrative content AND estimated market statistics.

${regionContext}

CRITICAL REQUIREMENTS:
- Include REAL, SPECIFIC facts about ${cityName}, ${stateName}
- Mention actual place names, landmarks, restaurants, parks, historical events
- NO generic phrases like "family-friendly community" or "growing area"
- For market statistics, provide REALISTIC ESTIMATES based on your knowledge of ${cityName}'s real estate market
- NEVER use markdown asterisks (**) for bold text. Use HTML <strong> tags instead if emphasis is needed.

Return a JSON object with these exact fields:

{
  "marketStats": {
    "population": <number - estimated population, e.g. 245000>,
    "medianHomePrice": <number - estimated median home price in dollars, e.g. 425000>,
    "medianHouseholdIncome": <number - estimated median household income, e.g. 72000>,
    "daysOnMarket": <number - estimated average days on market, e.g. 28>,
    "pricePerSqFt": <number - estimated price per square foot, e.g. 285>,
    "yearOverYearChange": <number - estimated YoY price change as decimal, e.g. 0.045 for 4.5%>,
    "inventoryLevel": "<string - 'Low', 'Moderate', or 'High'>",
    "marketType": "<string - 'Seller's Market', 'Buyer's Market', or 'Balanced'>",
    "averageHomeSize": <number - average home size in sqft, e.g. 1850>,
    "homeownershipRate": <number - as decimal, e.g. 0.68 for 68%>
  },
  
  "overview": "2-3 compelling sentences capturing ${cityName}'s unique character and appeal. What's the vibe? What's it known for?",
  
  "historicalFacts": ["3 interesting historical facts about ${cityName} - founding story, notable events, famous residents, how it got its name"],
  
  "pointsOfInterest": ["5-6 specific attractions, parks, restaurants, or landmarks in or near ${cityName} with brief descriptions"],
  
  "localCulture": "2-3 sentences about the lifestyle, community events, annual festivals, or local traditions that define ${cityName}",
  
  "highlights": ["4 specific reasons people move to ${cityName} - mention real employers, schools by name, recreational activities"],
  
  "neighborhoodTypes": ["4 specific neighborhood names or housing areas in ${cityName} with what makes each unique"],
  
  "buyerProfile": "Who specifically buys in ${cityName}? Young professionals? Retirees? Families? Tech workers? Be specific about demographics and motivations.",
  
  "marketTrends": "Current real estate dynamics - is it appreciating? What price ranges dominate? Any new developments? Be specific with numbers when possible.",
  
  "bestKeptSecret": "One insider tip or lesser-known fact that locals love about ${cityName}",
  
  "investmentOutlook": "2-3 sentences on the investment potential - job growth, infrastructure projects, appreciation forecast",
  
  "commuteTimes": {
    "toNearestMetro": "<string describing commute to nearest major city/metro area>",
    "majorEmployers": ["List 3-4 major employers in or near the city"]
  }
}

Write like a knowledgeable local real estate expert. Provide realistic market estimates based on the city's size, location, and economic profile. Do NOT use markdown formatting.`;

    console.log(`Generating enhanced content for ${cityName}, ${stateAbbrev}...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are a real estate market analyst specializing in ${stateName}. Provide factual, specific information about cities. For market statistics, provide realistic estimates based on your knowledge of real estate markets, city demographics, and regional economics. Always return valid JSON.` 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let contentText = aiData.choices?.[0]?.message?.content || '';
    
    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, contentText];
    contentText = jsonMatch[1].trim();
    
    let generatedContent;
    try {
      generatedContent = JSON.parse(contentText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', contentText);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate that marketStats exists and has required fields
    if (!generatedContent.marketStats) {
      console.error('Missing marketStats in response');
      throw new Error('AI response missing marketStats');
    }

    // Ensure numeric fields are actually numbers
    const stats = generatedContent.marketStats;
    stats.population = Number(stats.population) || 50000;
    stats.medianHomePrice = Number(stats.medianHomePrice) || 350000;
    stats.medianHouseholdIncome = Number(stats.medianHouseholdIncome) || 65000;
    stats.daysOnMarket = Number(stats.daysOnMarket) || 30;
    stats.pricePerSqFt = Number(stats.pricePerSqFt) || 200;
    stats.yearOverYearChange = Number(stats.yearOverYearChange) || 0.03;
    stats.averageHomeSize = Number(stats.averageHomeSize) || 1800;
    stats.homeownershipRate = Number(stats.homeownershipRate) || 0.65;

    // Add metadata
    generatedContent.metadata = {
      generatedAt: new Date().toISOString(),
      cityName,
      citySlug,
      stateName,
      stateAbbrev,
      version: '2.0-enhanced'
    };

    // Store the generated content in the database
    const { error: upsertError } = await supabase
      .from('marketing_content')
      .upsert({
        page: `city-${citySlug}`,
        section: 'market_overview_enhanced',
        key: 'full_content',
        type: 'json',
        value: JSON.stringify(generatedContent),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'page,section,key'
      });

    if (upsertError) {
      console.error('Failed to cache content:', upsertError);
    }

    console.log(`Generated enhanced content for ${cityName}, ${stateAbbrev} - Population: ${stats.population}, Median: $${stats.medianHomePrice}`);
    return new Response(JSON.stringify({ content: generatedContent, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating city content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getRegionContext(cityName: string, stateName: string): string {
  const lowerCity = cityName.toLowerCase();
  const lowerState = stateName.toLowerCase();
  
  // Arizona regions
  if (lowerState === 'arizona') {
    const phoenixMetro = ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'gilbert', 'glendale', 'peoria', 
      'surprise', 'goodyear', 'avondale', 'buckeye', 'queen creek', 'cave creek', 'carefree', 'fountain hills',
      'paradise valley', 'litchfield park', 'tolleson', 'el mirage', 'youngtown', 'sun city', 'sun city west',
      'anthem', 'apache junction', 'gold canyon', 'san tan valley'];
    const tucsonArea = ['tucson', 'oro valley', 'marana', 'sahuarita', 'green valley', 'vail', 'catalina', 'south tucson'];
    const flagstaffArea = ['flagstaff', 'sedona', 'cottonwood', 'camp verde', 'williams', 'page', 'prescott', 
      'prescott valley', 'chino valley', 'dewey-humboldt'];
    const yumaArea = ['yuma', 'san luis', 'somerton', 'wellton'];
    
    if (phoenixMetro.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the Phoenix Metropolitan Area, the 5th largest metro in the US. Reference desert lifestyle, monsoon season, proximity to major freeways (I-10, Loop 101, Loop 202), and the Valley's rapid growth.`;
    }
    if (tucsonArea.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the Tucson metro area. Reference the University of Arizona, Sonoran Desert, mountain ranges (Catalinas, Rincons), and the distinct character from Phoenix.`;
    }
    if (flagstaffArea.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in Northern Arizona's high country. Reference four seasons, proximity to Grand Canyon, NAU, skiing, and the cooler mountain climate.`;
    }
    if (yumaArea.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in southwestern Arizona near the California/Mexico borders. Reference agriculture, military presence (MCAS Yuma), and year-round warm climate.`;
    }
    return `REGIONAL CONTEXT: ${cityName} is in Arizona. Provide specific context about its location within the state and what makes it unique.`;
  }
  
  // California regions
  if (lowerState === 'california') {
    const bayArea = ['san francisco', 'oakland', 'berkeley', 'fremont', 'san jose', 'palo alto', 'mountain view', 
      'sunnyvale', 'cupertino', 'santa clara', 'milpitas', 'hayward', 'union city', 'newark', 'alameda',
      'san mateo', 'redwood city', 'menlo park', 'foster city', 'burlingame', 'daly city', 'south san francisco',
      'walnut creek', 'concord', 'pleasanton', 'livermore', 'dublin', 'san ramon', 'danville', 'orinda', 'lafayette',
      'moraga', 'martinez', 'richmond', 'el cerrito', 'albany', 'sausalito', 'tiburon', 'mill valley', 'san rafael',
      'novato', 'petaluma', 'napa', 'vallejo', 'benicia', 'hercules', 'pinole', 'los gatos', 'saratoga', 'campbell',
      'los altos', 'woodside', 'atherton', 'portola valley', 'half moon bay', 'pacifica', 'belmont', 'san carlos'];
    
    const laArea = ['los angeles', 'santa monica', 'beverly hills', 'west hollywood', 'culver city', 'marina del rey',
      'malibu', 'pacific palisades', 'brentwood', 'westwood', 'century city', 'hancock park', 'los feliz', 'silver lake',
      'echo park', 'downtown la', 'pasadena', 'glendale', 'burbank', 'calabasas', 'hidden hills', 'agoura hills',
      'westlake village', 'thousand oaks', 'encino', 'sherman oaks', 'studio city', 'north hollywood', 'toluca lake',
      'manhattan beach', 'hermosa beach', 'redondo beach', 'torrance', 'palos verdes', 'rancho palos verdes',
      'long beach', 'san pedro', 'carson', 'compton', 'inglewood', 'hawthorne', 'el segundo', 'playa del rey',
      'arcadia', 'monrovia', 'duarte', 'azusa', 'glendora', 'claremont', 'la verne', 'pomona', 'diamond bar',
      'walnut', 'west covina', 'covina', 'san dimas', 'la canada flintridge', 'altadena', 'south pasadena',
      'montebello', 'alhambra', 'san gabriel', 'temple city', 'monterey park', 'rosemead', 'el monte'];
    
    const oc = ['anaheim', 'santa ana', 'irvine', 'huntington beach', 'newport beach', 'costa mesa', 'laguna beach',
      'dana point', 'san clemente', 'san juan capistrano', 'mission viejo', 'lake forest', 'laguna niguel',
      'laguna hills', 'aliso viejo', 'ladera ranch', 'rancho santa margarita', 'coto de caza', 'fullerton',
      'orange', 'tustin', 'villa park', 'yorba linda', 'placentia', 'brea', 'garden grove', 'westminster',
      'fountain valley', 'cypress', 'los alamitos', 'seal beach', 'corona del mar', 'balboa island'];
    
    const sd = ['san diego', 'la jolla', 'del mar', 'solana beach', 'encinitas', 'carlsbad', 'oceanside',
      'vista', 'san marcos', 'escondido', 'poway', 'rancho bernardo', 'rancho santa fe', 'coronado',
      'chula vista', 'national city', 'imperial beach', 'la mesa', 'el cajon', 'santee', 'lakeside'];
    
    const ie = ['riverside', 'corona', 'moreno valley', 'temecula', 'murrieta', 'ontario', 'rancho cucamonga',
      'fontana', 'san bernardino', 'redlands', 'upland', 'chino', 'chino hills', 'eastvale',
      'jurupa valley', 'norco', 'lake elsinore', 'menifee', 'perris', 'hemet', 'palm springs', 'palm desert',
      'la quinta', 'indian wells', 'rancho mirage', 'cathedral city', 'indio', 'coachella'];
    
    const centralValley = ['sacramento', 'elk grove', 'roseville', 'folsom', 'rocklin', 'lincoln', 'citrus heights',
      'rancho cordova', 'davis', 'woodland', 'west sacramento', 'stockton', 'lodi', 'manteca', 'tracy', 'modesto',
      'turlock', 'merced', 'fresno', 'clovis', 'visalia', 'bakersfield', 'hanford', 'tulare', 'porterville', 'madera'];
    
    if (bayArea.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the San Francisco Bay Area, one of the most expensive and competitive real estate markets in the world. Reference proximity to tech hubs (Silicon Valley, SF), BART/Caltrain access, and the unique Bay Area lifestyle.`;
    }
    if (laArea.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the Greater Los Angeles area. Reference proximity to entertainment industry, beaches, freeways (405, 101, 10), and the diverse LA lifestyle and neighborhoods.`;
    }
    if (oc.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in Orange County, known for its beaches, master-planned communities, and family-friendly reputation. Reference proximity to Disneyland, beaches, and the distinct OC lifestyle.`;
    }
    if (sd.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the San Diego area, known for perfect weather, beaches, military presence, and biotech industry. Reference the laid-back SoCal beach lifestyle.`;
    }
    if (ie.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in the Inland Empire (Riverside/San Bernardino counties). Reference more affordable housing compared to coastal areas, growing logistics industry, and proximity to mountains and desert.`;
    }
    if (centralValley.some(c => lowerCity.includes(c) || c.includes(lowerCity))) {
      return `REGIONAL CONTEXT: ${cityName} is in California's Central Valley. Reference agriculture, more affordable housing than coastal California, growing tech spillover, and the unique valley lifestyle.`;
    }
    return `REGIONAL CONTEXT: ${cityName} is a California city. Provide specific context about its location and what makes it unique within California.`;
  }
  
  // Default for other states
  return `REGIONAL CONTEXT: ${cityName} is in ${stateName}. Provide specific context about its location within the state, nearby metros, and what makes it unique.`;
}
