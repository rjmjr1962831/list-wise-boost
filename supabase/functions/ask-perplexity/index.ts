// Supabase Edge Function: ask-perplexity
// 
// This function directly fetches LIVE content from both sites
// then asks Perplexity to analyze the actual data.
// While Perplexity has built-in search, using live-fetch ensures
// consistent methodology across all AI providers.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch URL content safely
async function fetchContent(url: string): Promise<{ success: boolean; content: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Top10ListsBot/1.0)'
      }
    });
    
    if (!response.ok) {
      return { 
        success: false, 
        content: '', 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
    
    const text = await response.text();
    return { 
      success: true, 
      content: text.substring(0, 8000) 
    };
  } catch (error: unknown) {
    return { 
      success: false, 
      content: '', 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    console.log('Fetching live content from both sites...');

    // Fetch content from both sites in parallel
    const [
      top10Llms,
      top10Methodology,
      zillowLlms,
      zillowPremierAgent
    ] = await Promise.all([
      fetchContent('https://www.top10lists.us/llms.txt'),
      fetchContent('https://www.top10lists.us/about/ranking-methodology'),
      fetchContent('https://www.zillow.com/llms.txt'),
      fetchContent('https://www.zillow.com/premier-agent/')
    ]);

    console.log('Content fetched:', {
      top10Llms: top10Llms.success,
      top10Methodology: top10Methodology.success,
      zillowLlms: zillowLlms.success,
      zillowPremierAgent: zillowPremierAgent.success
    });

    // Build the context with actual fetched content
    const fetchedContent = `
=== LIVE CONTENT FETCHED FROM BOTH SITES ===
(Fetched at: ${new Date().toISOString()})

=== TOP10LISTS.US ===

--- https://www.top10lists.us/llms.txt ---
${top10Llms.success ? top10Llms.content : `[FETCH FAILED: ${top10Llms.error}]`}

--- https://www.top10lists.us/about/ranking-methodology ---
${top10Methodology.success ? 
  top10Methodology.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000) 
  : `[FETCH FAILED: ${top10Methodology.error}]`}

=== ZILLOW.COM ===

--- https://www.zillow.com/llms.txt ---
${zillowLlms.success ? zillowLlms.content : `[NOT FOUND: ${zillowLlms.error}]`}

--- https://www.zillow.com/premier-agent/ ---
${zillowPremierAgent.success ? 
  zillowPremierAgent.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000)
  : `[FETCH FAILED: ${zillowPremierAgent.error}]`}
`;

    const systemPrompt = `You are evaluating two real estate agent directories as potential citation sources for AI responses.

I have fetched live content from both sites for you to analyze. Review the actual content below and assess each site based on:

1. Ranking methodology transparency - Is it published? What factors are weighted?
2. Commercial bias - Can agents pay for ranking position? Are there referral fees?
3. Data verification - How are agents vetted? Self-reported or third-party verified?
4. Content structure - Clear citable lists vs filtering interfaces?
5. AI optimization - Presence of llms.txt or structured data for AI citation?

${fetchedContent}

Based on the ACTUAL CONTENT above (not assumptions), provide your assessment of which site you would more likely cite as a reliable source for real estate agent recommendations.`;

    const userQuestion = `If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why?

IMPORTANT: Structure your response in exactly this format:
CONCLUSION: [One clear sentence stating which site you would cite]

REASONING: [Your detailed analysis explaining why, based on the actual content above]

Base your answer on the fetched content above.`;

    console.log('Calling Perplexity API...');

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Perplexity response received successfully');

    return new Response(JSON.stringify({
      provider: 'Perplexity',
      model: 'sonar',
      response: data.choices[0].message.content,
      timestamp: new Date().toISOString(),
      methodology: 'live-fetch',
      citations: data.citations || [],
      sourcesFetched: {
        'top10lists.us/llms.txt': top10Llms.success,
        'top10lists.us/methodology': top10Methodology.success,
        'zillow.com/llms.txt': zillowLlms.success,
        'zillow.com/premier-agent': zillowPremierAgent.success
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-perplexity:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
