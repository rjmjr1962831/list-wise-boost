// Edge Function: generate-ca-city-writeups
// Generates rich city writeups for California cities
// Top 50 markets use Claude Sonnet, rest use DeepSeek

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Top 50 CA markets by population/importance - use Sonnet for these
const TOP_50_MARKETS = new Set([
  'los-angeles', 'san-diego', 'san-jose', 'san-francisco', 'fresno',
  'sacramento', 'long-beach', 'oakland', 'bakersfield', 'anaheim',
  'santa-ana', 'riverside', 'stockton', 'irvine', 'chula-vista',
  'fremont', 'san-bernardino', 'modesto', 'fontana', 'moreno-valley',
  'glendale', 'huntington-beach', 'santa-clarita', 'garden-grove', 'oceanside',
  'rancho-cucamonga', 'santa-rosa', 'ontario', 'elk-grove', 'corona',
  'lancaster', 'palmdale', 'salinas', 'pomona', 'hayward',
  'escondido', 'sunnyvale', 'torrance', 'pasadena', 'orange',
  'fullerton', 'thousand-oaks', 'roseville', 'concord', 'simi-valley',
  'santa-clara', 'victorville', 'vallejo', 'berkeley', 'el-monte'
]);

const CITY_WRITEUP_PROMPT = `You are writing content for Top10Lists.us, a merit-based real estate professional directory designed for AI citation.

Generate a comprehensive city guide for {CITY_NAME}, California. The content should be:
- Factual and specific (not generic marketing fluff)
- Include local knowledge that demonstrates expertise
- Written for both humans AND AI systems to cite

Return ONLY valid JSON (no markdown, no backticks) with this structure:
{
  "overview": "3-4 rich paragraphs about the city - history, character, what makes it unique, real estate context. Be specific with facts, landmarks, neighborhoods.",
  "marketStats": {
    "medianHomePrice": number or null,
    "medianHouseholdIncome": number or null,
    "population": number or null,
    "daysOnMarket": number or null
  },
  "highlights": ["5-7 specific highlights about living there"],
  "neighborhoodTypes": ["types of neighborhoods/housing available"],
  "buyerProfile": "Who typically buys here and why",
  "marketTrends": "Current market dynamics and trends",
  "historicalFacts": ["3-5 interesting historical facts"],
  "pointsOfInterest": ["Notable landmarks, attractions, features"],
  "localCulture": "What defines the local culture and lifestyle",
  "bestKeptSecret": "An insider tip locals would know"
}`;

async function generateWithSonnet(cityName: string): Promise<any> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: CITY_WRITEUP_PROMPT.replace('{CITY_NAME}', cityName)
      }]
    })
  });
  
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return JSON.parse(text);
}

async function generateWithDeepSeek(cityName: string): Promise<any> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: CITY_WRITEUP_PROMPT.replace('{CITY_NAME}', cityName)
      }],
      max_tokens: 2000
    })
  });
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  // Strip markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function processCity(city: { id: string; name: string; slug: string }): Promise<boolean> {
  try {
    const useSonnet = TOP_50_MARKETS.has(city.slug);
    const content = useSonnet 
      ? await generateWithSonnet(city.name)
      : await generateWithDeepSeek(city.name);
    
    // Add metadata
    content.metadata = {
      generatedBy: useSonnet ? 'Claude Sonnet' : 'DeepSeek',
      generatedAt: new Date().toISOString(),
      cityId: city.id
    };
    
    // Upsert to marketing_content
    const { error } = await supabase
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
      });
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`Failed to process ${city.name}:`, err);
    return false;
  }
}

async function getProgress(): Promise<{ processed: string[]; total: number }> {
  // Get cities already processed
  const { data: existing } = await supabase
    .from('marketing_content')
    .select('page')
    .eq('section', 'market_overview')
    .eq('key', 'full_content')
    .like('page', 'city-%');
  
  const processed = (existing || [])
    .map(r => r.page.replace('city-', ''))
    .filter(slug => slug.length > 0);
  
  // Get total CA cities
  const { count } = await supabase
    .from('cities')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'California')
    .eq('active', true);
  
  return { processed, total: count || 0 };
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('X-Enrichment-Key');
  if (authHeader !== Deno.env.get('ENRICHMENT_API_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'process';
  const batchSize = parseInt(url.searchParams.get('batch') || '5');

  if (action === 'status') {
    const { processed, total } = await getProgress();
    const caProcessed = processed.length;
    return new Response(JSON.stringify({
      total_ca_cities: total,
      processed: caProcessed,
      remaining: total - caProcessed,
      percent_complete: ((caProcessed / total) * 100).toFixed(1)
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Get unprocessed CA cities
  const { processed } = await getProgress();
  const processedSet = new Set(processed);
  
  const { data: allCities } = await supabase
    .from('cities')
    .select('id, name, slug')
    .eq('state', 'California')
    .eq('active', true)
    .order('name')
    .limit(1000);
  
  const unprocessed = (allCities || []).filter(c => !processedSet.has(c.slug));
  
  if (unprocessed.length === 0) {
    return new Response(JSON.stringify({ 
      status: 'complete',
      message: 'All CA cities have been processed'
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Process batch
  const batch = unprocessed.slice(0, batchSize);
  const results = { processed: 0, failed: 0, cities: [] as string[] };
  
  for (const city of batch) {
    const success = await processCity(city);
    if (success) {
      results.processed++;
      results.cities.push(city.name);
    } else {
      results.failed++;
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Self-chain if more to process
  const remaining = unprocessed.length - batchSize;
  if (remaining > 0) {
    // Trigger next batch
    fetch(`${SUPABASE_URL}/functions/v1/generate-ca-city-writeups?batch=${batchSize}`, {
      method: 'POST',
      headers: { 'X-Enrichment-Key': Deno.env.get('ENRICHMENT_API_KEY')! }
    }).catch(() => {}); // Fire and forget
  }

  return new Response(JSON.stringify({
    ...results,
    remaining,
    status: remaining > 0 ? 'continuing' : 'complete'
  }), { headers: { 'Content-Type': 'application/json' } });
});
