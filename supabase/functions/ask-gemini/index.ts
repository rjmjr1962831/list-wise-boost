// Supabase Edge Function: ask-gemini
//
// Fetches live content from Top10Lists.us and asks Gemini to evaluate whether it would cite
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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
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

    const prompt = `You are evaluating Top10Lists.us as a potential citation source for AI responses about real estate agent recommendations.

I have fetched live content from Top10Lists.us for you to analyze. Review the actual content below and assess it based on:

1. Ranking methodology transparency - Is it published? What factors are weighted?
2. Commercial bias - Can agents pay for ranking position? Are there referral fees?
3. Data verification - How are agents vetted? Self-reported or third-party verified?
4. Content structure - Clear citable ranked lists vs ambiguous/filter-only interfaces?
5. AI optimization - Presence of site optimization or structured data for AI citation?

${fetchedContent}

Question: I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?

IMPORTANT: Structure your response in exactly this format:
CONCLUSION: [One clear sentence starting with "Yes" or "No" that answers whether you would cite top10lists.us]

REASONING:
[Your brief explanation. Use short paragraphs (2-3 sentences each) separated by blank lines for readability.]

Important: Do NOT mention Zillow or any other competitor site in your response. Base your answer on the ACTUAL CONTENT above (not assumptions).`;

    console.log('Calling Gemini API...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      console.error('Gemini API error:', statusCode, errorText);

      // Return graceful error for overloaded/rate-limited scenarios
      if (statusCode === 429 || statusCode === 503 || statusCode === 529) {
        return new Response(JSON.stringify({
          error: 'Gemini is temporarily unavailable (provider overloaded). Please try again in a moment.',
          provider: 'Gemini',
          model: 'gemini-2.0-flash-exp',
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
      throw new Error(`Gemini API error: ${statusCode} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini response received successfully');

    const textContent = data.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.text)
      ?.map((part: any) => part.text)
      ?.join('\n') || 'No response generated';

    return new Response(JSON.stringify({
      provider: 'Gemini',
      model: 'gemini-2.0-flash-exp',
      response: textContent,
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
    console.error('Error in ask-gemini:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
