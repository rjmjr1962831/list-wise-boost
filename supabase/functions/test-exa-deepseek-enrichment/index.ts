import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Excluded people-search spam domains
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
  "zabasearch.com"
];

interface ExaResult {
  url: string;
  title: string;
  text: string;
  highlights: string[];
  publishedDate?: string;
}

interface AgentEnrichmentData {
  pressRemarks: string[];
  awardsRecognition: string[];
  communityInvolvement: string[];
  publications: string[];
  verifiedSources: { url: string; description: string }[];
  confidence: "high" | "medium" | "low";
  summary: string;
}

// Step 1: Exa Search
async function searchAgentEnrichment(
  agentName: string,
  city: string,
  state: string,
  exaApiKey: string
): Promise<ExaResult[]> {
  
  // Query 1: Professional recognition and press
  const professionalQuery = `"${agentName}" ${city} ${state} realtor OR "real estate agent" (award OR recognition OR "top agent" OR "best realtor" OR featured OR press OR news OR magazine)`;
  
  // Query 2: Community involvement
  const communityQuery = `"${agentName}" ${city} ${state} (nonprofit OR charity OR "board member" OR volunteer OR foundation OR "gives back" OR community OR philanthropy)`;
  
  const results: ExaResult[] = [];
  
  // Run both queries
  for (const query of [professionalQuery, communityQuery]) {
    console.log(`Exa query: ${query.substring(0, 100)}...`);
    
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
      console.error(`Exa API error: ${response.status}`, errorText);
      throw new Error(`Exa API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.results) {
      results.push(...data.results.map((r: any) => ({
        url: r.url,
        title: r.title,
        text: r.text || "",
        highlights: r.highlights || [],
        publishedDate: r.publishedDate
      })));
    }
  }
  
  // Deduplicate by URL
  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex(r => r.url === result.url)
  );
  
  console.log(`Exa returned ${uniqueResults.length} unique results`);
  return uniqueResults;
}

// Step 2: DeepSeek Synthesis
async function synthesizeAgentData(
  agentName: string,
  city: string,
  state: string,
  searchResults: ExaResult[],
  deepseekApiKey: string
): Promise<AgentEnrichmentData> {
  
  const prompt = `You are verifying and synthesizing search results for a specific real estate agent.

TARGET AGENT:
- Name: ${agentName}
- Location: ${city}, ${state}
- Profession: Real Estate Agent/Broker

SEARCH RESULTS:
${searchResults.map((r, i) => `
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

  console.log(`Calling DeepSeek for synthesis...`);

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
    console.error(`DeepSeek API error: ${response.status}`, errorText);
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  
  console.log(`DeepSeek raw response: ${content.substring(0, 500)}...`);
  
  // Parse JSON, handle potential markdown code blocks
  let jsonStr = content;
  if (content.includes("```json")) {
    jsonStr = content.split("```json")[1].split("```")[0].trim();
  } else if (content.includes("```")) {
    jsonStr = content.split("```")[1].split("```")[0].trim();
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse DeepSeek response:", content);
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
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    
    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY is not configured');
    }
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 3;
    
    // For Texas agents, we need city info - let's use a default or search for it
    // Since these agents don't have city in the DB, we'll need to search broadly
    const testAgents = [
      { name: "Brent Alan Crawford", license: "684700-SA", city: "Texas", state: "TX" },
      { name: "Eun Shin", license: "650357-SA", city: "Texas", state: "TX" },
      { name: "Vicki Wiley Sepher", license: "480202-SA", city: "Texas", state: "TX" }
    ];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING EXA + DEEPSEEK ENRICHMENT PIPELINE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Processing ${testAgents.length} Texas agents`);

    const results = [];

    for (const agent of testAgents.slice(0, limit)) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`Agent: ${agent.name} (${agent.license})`);
      console.log(`${'─'.repeat(50)}`);
      
      const startTime = Date.now();
      
      try {
        // Step 1: Exa Search
        const searchResults = await searchAgentEnrichment(
          agent.name,
          agent.city,
          agent.state,
          EXA_API_KEY
        );
        
        if (searchResults.length === 0) {
          console.log(`No search results found for ${agent.name}`);
          results.push({
            agent: agent.name,
            license: agent.license,
            success: true,
            searchResults: 0,
            enrichment: {
              pressRemarks: [],
              awardsRecognition: [],
              communityInvolvement: [],
              publications: [],
              verifiedSources: [],
              confidence: "low",
              summary: "No public information found beyond basic real estate listings."
            },
            elapsed_ms: Date.now() - startTime
          });
          continue;
        }
        
        // Step 2: DeepSeek Synthesis
        const enrichment = await synthesizeAgentData(
          agent.name,
          agent.city,
          agent.state,
          searchResults,
          DEEPSEEK_API_KEY
        );
        
        console.log(`\nEnrichment Result:`);
        console.log(`  Confidence: ${enrichment.confidence}`);
        console.log(`  Press mentions: ${enrichment.pressRemarks.length}`);
        console.log(`  Awards: ${enrichment.awardsRecognition.length}`);
        console.log(`  Community: ${enrichment.communityInvolvement.length}`);
        console.log(`  Publications: ${enrichment.publications.length}`);
        console.log(`  Summary: ${enrichment.summary}`);
        
        results.push({
          agent: agent.name,
          license: agent.license,
          success: true,
          searchResults: searchResults.length,
          enrichment,
          elapsed_ms: Date.now() - startTime
        });
        
      } catch (error) {
        console.error(`Error processing ${agent.name}:`, error);
        results.push({
          agent: agent.name,
          license: agent.license,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          elapsed_ms: Date.now() - startTime
        });
      }
      
      // Small delay between agents
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`ENRICHMENT COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total agents: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      },
      results
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
