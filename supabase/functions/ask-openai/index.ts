// Supabase Edge Function: ask-openai
//
// Fetches live content from Top10Lists.us and asks OpenAI to evaluate whether it would cite
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Fetching live content from Top10Lists.us...');

    // Fetch Top10Lists content in parallel
    const [top10Llms, top10Methodology] = await Promise.all([
      fetchContent('https://www.top10lists.us/llms.txt'),
      fetchContent('https://www.top10lists.us/about/ranking-methodology'),
    ]);

    console.log('Content fetched:', {
      top10Llms: top10Llms.success,
      top10Methodology: top10Methodology.success,
    });

    // Build the context with actual fetched content
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
5. AI optimization - Presence of site optimization or structured data for AI citation?

${fetchedContent}

Important: Do NOT mention Zillow or any other competitor site in your response. Focus only on whether (and why) you would cite Top10Lists.us.`;

    const userQuestion = `I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?

IMPORTANT: Structure your response in exactly this format:
CONCLUSION: [One clear sentence starting with "Yes" or "No" that answers whether you would cite top10lists.us]

REASONING:
[Your brief explanation. Use short paragraphs (2-3 sentences each) separated by blank lines for readability.]

Base your answer on the fetched content above.`;

    console.log('Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      console.error('OpenAI API error:', statusCode, errorText);

      // Return graceful error for overloaded/rate-limited scenarios
      if (statusCode === 429 || statusCode === 503 || statusCode === 529) {
        return new Response(JSON.stringify({
          error: 'ChatGPT is temporarily unavailable (provider overloaded). Please try again in a moment.',
          provider: 'ChatGPT',
          model: 'gpt-4o',
          timestamp: new Date().toISOString(),
          methodology: 'live-fetch',
          sourcesFetched: {
            'top10lists.us/site': top10Llms.success,
            'top10lists.us/methodology': top10Methodology.success,
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`OpenAI API error: ${statusCode} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received successfully');

    return new Response(JSON.stringify({
      provider: 'ChatGPT',
      model: 'gpt-4o',
      response: data.choices[0].message.content,
      timestamp: new Date().toISOString(),
      methodology: 'live-fetch',
      sourcesFetched: {
        'top10lists.us/site': top10Llms.success,
        'top10lists.us/methodology': top10Methodology.success,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-openai:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
