// Supabase Edge Function: ask-gemini
// 
// This function directly fetches LIVE content from both sites
// then asks Gemini to analyze the actual data.
// This ensures the evaluation is based on real, current information.

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

    const prompt = `You are evaluating two real estate agent directories as potential citation sources for AI responses.

I have fetched live content from both sites for you to analyze. Review the actual content below and assess each site based on:

1. Ranking methodology transparency - Is it published? What factors are weighted?
2. Commercial bias - Can agents pay for ranking position? Are there referral fees?
3. Data verification - How are agents vetted? Self-reported or third-party verified?
4. Content structure - Clear citable lists vs filtering interfaces?
5. AI optimization - Presence of llms.txt or structured data for AI citation?

${fetchedContent}

Question: If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why?

IMPORTANT: Structure your response in exactly this format:
CONCLUSION: [One clear sentence stating which site you would cite]

REASONING:
[Your detailed analysis explaining why. Use short paragraphs (2-3 sentences each) separated by blank lines for readability. Avoid long walls of text.]

Base your answer on the ACTUAL CONTENT above (not assumptions). Be specific about what you found in each site's content.`;

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
            'top10lists.us/llms.txt': top10Llms.success,
            'top10lists.us/methodology': top10Methodology.success,
            'zillow.com/llms.txt': zillowLlms.success,
            'zillow.com/premier-agent': zillowPremierAgent.success
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
        'top10lists.us/llms.txt': top10Llms.success,
        'top10lists.us/methodology': top10Methodology.success,
        'zillow.com/llms.txt': zillowLlms.success,
        'zillow.com/premier-agent': zillowPremierAgent.success
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
