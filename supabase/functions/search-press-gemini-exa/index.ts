import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PressMention {
  title: string;
  url: string;
  outlet?: string;
  date?: string;
  credibilityScore?: number;
}

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  highlights?: string[];
  publishedDate?: string;
}

// Call Gemini Flash via Lovable AI Gateway
async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini error:', response.status, error);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Search with Exa API
async function searchWithExa(query: string, category: string = 'news'): Promise<ExaResult[]> {
  const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
  if (!EXA_API_KEY) {
    console.log('EXA_API_KEY not configured, skipping Exa search');
    return [];
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': EXA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        useAutoprompt: true,
        numResults: 15,
        type: 'auto',
        contents: {
          text: { maxCharacters: 1500 },
          highlights: true,
        },
        category,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Exa API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Exa search error:', error);
    return [];
  }
}

// Use Gemini to analyze Exa results and extract verified press mentions
async function extractPressMentionsFromResults(
  agentName: string,
  results: ExaResult[]
): Promise<PressMention[]> {
  if (results.length === 0) return [];

  const resultsContext = results.map(r => ({
    title: r.title,
    url: r.url,
    text: r.text?.substring(0, 500) || '',
    date: r.publishedDate,
  }));

  const prompt = `Agent name: "${agentName}"

Search results to analyze:
${JSON.stringify(resultsContext, null, 2)}

Extract VERIFIED press mentions, news articles, and media coverage about this specific real estate agent.

For each press mention found, provide:
- title: The article/interview headline
- url: The source URL
- outlet: Publication name (e.g., "Wall Street Journal", "Phoenix Business Journal", "AZCentral")
- date: Publication date if found (YYYY-MM-DD format)
- credibilityScore: 1-10 rating
  - 10: Major national outlets (WSJ, NYT, Forbes, CNN)
  - 8-9: Major regional/industry publications (Phoenix Business Journal, RealTrends)
  - 6-7: Local news outlets, industry blogs
  - 4-5: Community news, press releases
  - 1-3: Directories, profile pages (exclude these)

RULES:
- ONLY include results where the agent's name "${agentName}" actually appears
- EXCLUDE Zillow, Realtor.com, Redfin profile pages
- EXCLUDE directory listings
- FOCUS on: interviews, features, award announcements, transaction news, expert quotes
- Be thorough - check every result for legitimate press coverage
- If the result is about a DIFFERENT person with the same name, exclude it

Return as JSON array. If no verified press mentions found, return empty array [].`;

  const result = await callGemini(prompt, 'You are a press mention researcher. Extract verified press mentions. Return only valid JSON array.');

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const mentions = JSON.parse(jsonMatch[0]);
      // Only keep mentions with credibility >= 4
      return mentions.filter((m: PressMention) => m.credibilityScore && m.credibilityScore >= 4);
    }
  } catch (e) {
    console.error('Could not parse press mentions:', e);
  }

  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, agentName, brokerage, city, state, dryRun = false } = await req.json();

    if (!agentName) {
      throw new Error('agentName is required');
    }

    console.log(`[Press Search] Starting for: ${agentName} (${city}, ${state})`);

    const allResults: ExaResult[] = [];
    const location = city && state ? `${city} ${state}` : (city || state || '');

    // Build multiple search queries
    const queries = [
      `"${agentName}" real estate agent press interview article`,
      `"${agentName}" real estate ${location} news feature`,
      `"${agentName}" real estate award recognition`,
    ];

    if (brokerage) {
      queries.push(`"${agentName}" ${brokerage} real estate news`);
    }

    // Run Exa searches
    console.log('[Press Search] Running Exa searches...');
    for (const query of queries) {
      console.log(`  Query: ${query}`);
      const results = await searchWithExa(query, 'news');
      allResults.push(...results);
      await new Promise(r => setTimeout(r, 300)); // Rate limiting
    }

    // Also search in company category
    const companyQuery = `"${agentName}" real estate agent ${location}`;
    console.log(`  Query (company): ${companyQuery}`);
    const companyResults = await searchWithExa(companyQuery, 'company');
    allResults.push(...companyResults);

    console.log(`[Press Search] Total Exa results: ${allResults.length}`);

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    console.log(`[Press Search] Unique results after dedup: ${uniqueResults.length}`);

    // Use Gemini to analyze and extract press mentions
    console.log('[Press Search] Analyzing results with Gemini...');
    const pressMentions = await extractPressMentionsFromResults(agentName, uniqueResults);

    console.log(`[Press Search] Found ${pressMentions.length} verified press mentions`);

    // Update database if not dry run
    if (!dryRun && professionalId && pressMentions.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
        .from('professionals')
        .update({ press_mentions: pressMentions })
        .eq('id', professionalId);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log(`[Press Search] Updated database for ${professionalId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      agentName,
      totalExaResults: allResults.length,
      uniqueResults: uniqueResults.length,
      pressMentions,
      dryRun,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-press-gemini-exa:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
