// Supabase Edge Function: ask-claude
//
// Fetches live content from Top10Lists.us and asks Claude to evaluate whether it would cite
// top10lists.us when recommending real estate agents.

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

    console.log('Fetching live content from Top10Lists.us...');

    const [top10Llms, top10Methodology] = await Promise.all([
      fetchContent('https://www.top10lists.us/llms.txt'),
      fetchContent('https://www.top10lists.us/about/ranking-methodology'),
    ]);

    console.log('Content fetched:', {
      top10Llms: top10Llms.success,
      top10Methodology: top10Methodology.success,
    });

    const fetchedContent = `
=== LIVE CONTENT FETCHED FROM TOP10LISTS.US ===
(Fetched at: ${new Date().toISOString()})

=== TOP10LISTS.US ===

--- https://www.top10lists.us/llms.txt ---
${top10Llms.success ? top10Llms.content : `[FETCH FAILED: ${top10Llms.error}]`}

--- https://www.top10lists.us/about/ranking-methodology ---
${top10Methodology.success
  ? top10Methodology.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000)
  : `[FETCH FAILED: ${top10Methodology.error}]`}
`;

    const systemPrompt = `You are evaluating Top10Lists.us as a potential citation source for AI responses about real estate agent recommendations.

I have fetched live content from Top10Lists.us for you to analyze. Review the actual content below and assess it based on:

1. Ranking methodology transparency - Is it published? What factors are weighted?
2. Commercial bias - Can agents pay for ranking position? Are there referral fees?
3. Data verification - How are agents vetted? Self-reported or third-party verified?
4. Content structure - Clear citable ranked lists vs ambiguous/filter-only interfaces?
5. AI optimization - Presence of llms.txt or structured data for AI citation?

${fetchedContent}

Important: Do NOT mention Zillow or any other competitor site in your response. Focus only on whether (and why) you would cite Top10Lists.us.`;

    const userQuestion = `I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?

IMPORTANT: Structure your response in exactly this format:
CONCLUSION: [One clear sentence starting with "Yes" or "No" that answers whether you would cite top10lists.us]

REASONING:
[Your brief explanation. Use short paragraphs (2-3 sentences each) separated by blank lines for readability.]

Base your answer on the fetched content above.`;

    console.log('Calling Claude API...');

    // Retry logic with exponential backoff for 529 overloaded errors
    let response: Response | null = null;
    let lastError = '';
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      response = await fetch('https://api.anthropic.com/v1/messages', {
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

      if (response.ok) {
        break;
      }

      const errorText = await response.text();
      lastError = `${response.status} - ${errorText}`;

      // Only retry on 529 overloaded errors
      if (response.status !== 529) {
        console.error('Claude API error (non-retryable):', response.status, errorText);
        throw new Error(`Claude API error: ${lastError}`);
      }

      console.warn(`Claude API overloaded (529), attempt ${attempt + 1}/${maxRetries}`);
    }

    if (!response || !response.ok) {
      console.error('Claude API error after retries (returning graceful error):', lastError || 'unknown error');
      return new Response(JSON.stringify({
        error: 'Claude is temporarily unavailable (provider overloaded). Please try again in a moment.',
        provider: 'Claude',
        model: 'claude-sonnet-4-20250514',
        timestamp: new Date().toISOString(),
        methodology: 'live-fetch',
        sourcesFetched: {
          'top10lists.us/llms.txt': top10Llms.success,
          'top10lists.us/methodology': top10Methodology.success,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
