import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Domains to exclude - data broker sites that don't provide real press value
const EXCLUDED_DOMAINS = [
  "whitepages.com",
  "spokeo.com",
  "beenverified.com",
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "thatsthem.com",
  "radaris.com",
  "intelius.com",
  "peoplefinders.com",
  "usphonebook.com",
  "mylife.com",
  "instantcheckmate.com",
  "truthfinder.com",
  "cocofinder.com",
  "zabasearch.com",
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "homes.com",
  "trulia.com"
];

interface ExaResult {
  url: string;
  title: string;
  text: string;
  highlights: string[];
  publishedDate?: string;
}

interface EnrichmentData {
  pressRemarks: string[];
  awardsRecognition: string[];
  communityInvolvement: string[];
  publications: string[];
  verifiedSources: { url: string; description: string }[];
  confidence: "high" | "medium" | "low";
  summary: string;
}

// Search with Exa.ai - runs two targeted queries
async function searchWithExa(
  agentName: string,
  city: string,
  state: string,
  exaApiKey: string
): Promise<ExaResult[]> {
  console.log(`🔍 Exa search for: ${agentName} in ${city}, ${state}`);

  // Query 1: Professional recognition and press
  const professionalQuery = `"${agentName}" ${city} ${state} realtor OR "real estate agent" (award OR recognition OR "top agent" OR "best realtor" OR featured OR press OR news OR magazine)`;
  
  // Query 2: Community involvement
  const communityQuery = `"${agentName}" ${city} ${state} (nonprofit OR charity OR "board member" OR volunteer OR foundation OR "gives back" OR community OR philanthropy)`;

  const results: ExaResult[] = [];

  for (const query of [professionalQuery, communityQuery]) {
    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": exaApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          type: "auto",
          numResults: 15,
          contents: {
            text: { maxCharacters: 2000 },
            highlights: { numSentences: 3 }
          },
          excludeDomains: EXCLUDED_DOMAINS
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Exa API error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.results) {
        results.push(...data.results.map((r: any) => ({
          url: r.url,
          title: r.title || '',
          text: r.text || '',
          highlights: r.highlights || [],
          publishedDate: r.publishedDate
        })));
      }
    } catch (error) {
      console.error(`Exa search error for query "${query.substring(0, 50)}...":`, error);
    }
  }

  // Deduplicate by URL
  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex(r => r.url === result.url)
  );

  console.log(`✅ Exa found ${uniqueResults.length} unique results`);
  return uniqueResults;
}

// Synthesize with DeepSeek - filters and extracts structured data
async function synthesizeWithDeepSeek(
  agentName: string,
  city: string,
  state: string,
  company: string,
  searchResults: ExaResult[],
  deepseekApiKey: string
): Promise<EnrichmentData> {
  console.log(`🧠 DeepSeek synthesis for: ${agentName} (${searchResults.length} results)`);

  if (searchResults.length === 0) {
    return {
      pressRemarks: [],
      awardsRecognition: [],
      communityInvolvement: [],
      publications: [],
      verifiedSources: [],
      confidence: "low",
      summary: "No public information found beyond basic real estate listings."
    };
  }

  const prompt = `You are verifying and synthesizing search results for a specific real estate agent.

TARGET AGENT:
- Name: ${agentName}
- Company: ${company || 'Not specified'}
- Location: ${city}, ${state}
- Profession: Real Estate Agent/Broker

SEARCH RESULTS:
${searchResults.slice(0, 15).map((r, i) => `
[Result ${i + 1}]
URL: ${r.url}
Title: ${r.title}
Content: ${r.text?.substring(0, 1500) || r.highlights?.join(" ") || "No content"}
`).join("\n---\n")}

TASK:
1. FILTER: Only include information that clearly refers to THIS specific person (must match name + location + real estate context). Discard results about different people with similar names.

2. EXTRACT the following categories:
   - Press mentions (news articles, magazine features, interviews)
   - Awards and recognition (industry awards, "top agent" lists, professional honors)
   - Community involvement (nonprofit board seats, charity work, volunteer roles, foundation involvement)
   - Publications (books, articles authored by the agent)

3. For each item extracted, note the source URL.

4. Assign a confidence level:
   - HIGH: Multiple verified sources, clear name/location match
   - MEDIUM: Some verified sources, reasonable match
   - LOW: Limited sources or potential name confusion

5. Write a 2-3 sentence summary of this agent's public profile beyond basic real estate work.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "pressRemarks": ["Description of press mention - Source Name"],
  "awardsRecognition": ["Award or recognition - Year if known"],
  "communityInvolvement": ["Role/organization - Description"],
  "publications": ["Title - Year if known"],
  "verifiedSources": [{"url": "https://...", "description": "What this source verifies"}],
  "confidence": "high|medium|low",
  "summary": "2-3 sentence summary of agent's public profile"
}

If no relevant information is found for a category, use an empty array [].
Only output valid JSON, no other text.`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deepseekApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a research assistant that extracts and verifies information about real estate professionals. You are careful to disambiguate between people with similar names. You only output valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API error: ${response.status} - ${errorText}`);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON, handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0].trim();
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0].trim();
    }

    const parsed = JSON.parse(jsonStr);
    console.log(`✅ DeepSeek synthesis complete: ${parsed.confidence} confidence`);
    
    return {
      pressRemarks: parsed.pressRemarks || [],
      awardsRecognition: parsed.awardsRecognition || [],
      communityInvolvement: parsed.communityInvolvement || [],
      publications: parsed.publications || [],
      verifiedSources: parsed.verifiedSources || [],
      confidence: parsed.confidence || "low",
      summary: parsed.summary || ""
    };

  } catch (error) {
    console.error("DeepSeek synthesis error:", error);
    return {
      pressRemarks: [],
      awardsRecognition: [],
      communityInvolvement: [],
      publications: [],
      verifiedSources: [],
      confidence: "low",
      summary: "Unable to parse enrichment data"
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      agentName, 
      company, 
      businessName, 
      city, 
      state, 
      professionalId, 
      dryRun = false,
      skipIfNoPress = true 
    } = await req.json();

    if (!agentName) {
      return new Response(
        JSON.stringify({ error: 'Agent name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exaApiKey = Deno.env.get('EXA_API_KEY');
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    
    if (!exaApiKey) {
      throw new Error('EXA_API_KEY not configured');
    }
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const companyDisplay = company || businessName || '';

    console.log(`🚀 Starting Exa+DeepSeek enrichment for: ${agentName}`);
    const startTime = Date.now();

    // Step 1: Search with Exa
    const searchResults = await searchWithExa(agentName, city, state, exaApiKey);

    // Step 2: Synthesize with DeepSeek
    const enrichmentData = await synthesizeWithDeepSeek(
      agentName,
      city,
      state,
      companyDisplay,
      searchResults,
      deepseekApiKey
    );

    const elapsed = Date.now() - startTime;
    console.log(`⏱️ Total enrichment time: ${elapsed}ms`);

    // Build press_mentions array for backwards compatibility
    const pressMentions = enrichmentData.verifiedSources.map((source, index) => ({
      url: source.url,
      source: (() => {
        try {
          return new URL(source.url).hostname.replace('www.', '');
        } catch {
          return 'unknown';
        }
      })(),
      type: 'article',
      credibilityScore: 7,
      title: source.description
    }));

    // Save to professionals table if we have a professionalId
    if (professionalId && !dryRun) {
      const updateData: any = {
        press_mentions: pressMentions.length > 0 ? pressMentions : null
      };

      // Also store the full enrichment data in professional_data
      const { data: currentProf } = await supabase
        .from('professionals')
        .select('professional_data')
        .eq('id', professionalId)
        .single();

      const existingData = currentProf?.professional_data || {};
      updateData.professional_data = {
        ...existingData,
        exaEnrichment: {
          ...enrichmentData,
          searchResultCount: searchResults.length,
          enrichedAt: new Date().toISOString()
        }
      };

      const { error: updateError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professionalId);

      if (updateError) {
        console.error('❌ Failed to save enrichment data:', updateError);
      } else {
        console.log(`✅ Saved enrichment for ${agentName}`);
      }
    }

    // Auto-trigger profile synthesis if we found content
    const hasContent = searchResults.length > 0 && enrichmentData.confidence !== 'low';
    const shouldSynthesize = professionalId && hasContent && !dryRun;
    
    let synthesisResult = null;
    let synthesisError = null;

    if (shouldSynthesize && (!skipIfNoPress || hasContent)) {
      console.log(`🔄 Auto-triggering profile synthesis for ${agentName}...`);
      
      try {
        const rawResearch = `# Exa Research for ${agentName}

## Context
Agent: ${agentName}
${companyDisplay ? `Company: ${companyDisplay}` : ''}
Location: ${city}, ${state}

## Summary
${enrichmentData.summary}

## Press & Recognition
${enrichmentData.pressRemarks.length > 0 ? enrichmentData.pressRemarks.map(p => `- ${p}`).join('\n') : 'No press mentions found.'}

## Awards
${enrichmentData.awardsRecognition.length > 0 ? enrichmentData.awardsRecognition.map(a => `- ${a}`).join('\n') : 'No awards found.'}

## Community Involvement
${enrichmentData.communityInvolvement.length > 0 ? enrichmentData.communityInvolvement.map(c => `- ${c}`).join('\n') : 'No community involvement found.'}

## Publications
${enrichmentData.publications.length > 0 ? enrichmentData.publications.map(p => `- ${p}`).join('\n') : 'No publications found.'}

# SOURCE CITATIONS
${enrichmentData.verifiedSources.length > 0 
  ? enrichmentData.verifiedSources.map((s, i) => `${i + 1}. ${s.url} - ${s.description}`).join('\n') 
  : 'No external citations found.'}`;

        const { data: synthData, error: synthErr } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: {
            professionalId,
            skipIfNoPress: false,
            rawResearch
          }
        });

        if (synthErr) {
          console.error('❌ Profile synthesis failed:', synthErr);
          synthesisError = synthErr.message || 'Synthesis failed';
        } else {
          console.log('✅ Profile synthesis completed successfully');
          synthesisResult = synthData;
        }
      } catch (synthError) {
        console.error('❌ Failed to trigger synthesis:', synthError);
        synthesisError = synthError instanceof Error ? synthError.message : 'Unknown synthesis error';
      }
    }

    return new Response(
      JSON.stringify({
        mentions: pressMentions,
        provider: 'exa+deepseek',
        searchResultCount: searchResults.length,
        enrichmentData,
        elapsedMs: elapsed,
        synthesis: {
          triggered: shouldSynthesize && (!skipIfNoPress || hasContent),
          success: !!synthesisResult && !synthesisError,
          error: synthesisError
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-agent-exa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
