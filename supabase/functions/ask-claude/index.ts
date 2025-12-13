// Supabase Edge Function: ask-claude
// 
// This function directly fetches content from both sites
// then asks Claude to analyze the actual data.
// This is more reliable than web_search which may not find newer sites.

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
    // Truncate to avoid token limits (keep first 8000 chars)
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
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
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
  // Extract text content, strip HTML tags for readability
  top10Methodology.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000) 
  : `[FETCH FAILED: ${top10Methodology.error}]`}

=== ZILLOW.COM ===

--- https://www.zillow.com/llms.txt ---
${zillowLlms.success ? zillowLlms.content : `[NOT FOUND: ${zillowLlms.error}]`}

--- https://www.zillow.com/premier-agent/ ---
${zillowPremierAgent.success ? 
  // Extract text content, strip HTML tags
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

    const userQuestion = 'If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why? Base your answer on the fetched content above.';

    console.log('Calling Claude API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userQuestion }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Claude response received successfully');
    
    // Extract text from response content blocks
    const textContent = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return new Response(JSON.stringify({
      provider: 'Claude',
      model: 'claude-sonnet-4-20250514',
      response: textContent,
      timestamp: new Date().toISOString(),
      methodology: 'live-fetch',
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
    console.error('Error in ask-claude:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
