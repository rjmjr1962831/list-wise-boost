import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Domains to exclude - data broker sites and basic listings
const EXCLUDED_DOMAINS = [
  // Data brokers
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
  "veripages.com",
  // Basic real estate listings (we want press, not listings)
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "homes.com",
  "trulia.com"
  // NOTE: We ALLOW Amazon, ThriftBooks, Stage32, Flickr, Google Books for author/book/media content
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
  tvAppearances: string[];
  speakingEngagements: string[];
  verifiedSources: { url: string; description: string }[];
  confidence: "high" | "medium" | "low";
  summary: string;
}

interface ConfidenceScore {
  score: number;
  level: "high" | "medium" | "low";
  signals: string[];
  recommendedModel: "deepseek" | "gemini";
}

// Calculate objective confidence score BEFORE LLM synthesis
function calculateConfidence(
  agentName: string,
  city: string,
  state: string,
  searchResults: ExaResult[]
): ConfidenceScore {
  let score = 0;
  const signals: string[] = [];
  const nameParts = agentName.toLowerCase().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  // 1. Result count (max 20 pts)
  if (searchResults.length >= 20) {
    score += 20;
    signals.push(`Strong result count: ${searchResults.length} results`);
  } else if (searchResults.length >= 10) {
    score += 15;
    signals.push(`Good result count: ${searchResults.length} results`);
  } else if (searchResults.length >= 5) {
    score += 10;
    signals.push(`Moderate result count: ${searchResults.length} results`);
  } else if (searchResults.length > 0) {
    score += 5;
    signals.push(`Limited results: ${searchResults.length} results`);
  }

  // 2. Name match rate (max 25 pts)
  const nameMatchCount = searchResults.filter(r => {
    const content = (r.title + ' ' + r.text).toLowerCase();
    return content.includes(firstName) && content.includes(lastName);
  }).length;
  const nameMatchRate = searchResults.length > 0 ? nameMatchCount / searchResults.length : 0;
  
  if (nameMatchRate >= 0.8) {
    score += 25;
    signals.push(`Excellent name match: ${Math.round(nameMatchRate * 100)}%`);
  } else if (nameMatchRate >= 0.6) {
    score += 20;
    signals.push(`Good name match: ${Math.round(nameMatchRate * 100)}%`);
  } else if (nameMatchRate >= 0.4) {
    score += 12;
    signals.push(`Moderate name match: ${Math.round(nameMatchRate * 100)}%`);
  } else if (nameMatchRate > 0) {
    score += 5;
    signals.push(`Low name match: ${Math.round(nameMatchRate * 100)}%`);
  }

  // 3. Domain diversity (max 20 pts)
  const uniqueDomains = new Set(searchResults.map(r => {
    try { return new URL(r.url).hostname.replace('www.', ''); } catch { return ''; }
  }));
  const domainCount = uniqueDomains.size;
  
  if (domainCount >= 10) {
    score += 20;
    signals.push(`High domain diversity: ${domainCount} sources`);
  } else if (domainCount >= 6) {
    score += 15;
    signals.push(`Good domain diversity: ${domainCount} sources`);
  } else if (domainCount >= 3) {
    score += 10;
    signals.push(`Moderate domain diversity: ${domainCount} sources`);
  } else if (domainCount > 0) {
    score += 5;
    signals.push(`Limited domain diversity: ${domainCount} sources`);
  }

  // 4. Key signal keywords (max 35 pts)
  const allContent = searchResults.map(r => (r.title + ' ' + r.text).toLowerCase()).join(' ');
  const keySignals = [
    { keywords: ['award', 'recognition', 'honored', 'top agent', 'best realtor'], points: 7, label: 'awards' },
    { keywords: ['book', 'author', 'published', 'wrote'], points: 7, label: 'publications' },
    { keywords: ['television', 'tv', 'abc', 'nbc', 'cbs', 'fox', 'lifetime', 'hgtv'], points: 7, label: 'TV appearances' },
    { keywords: ['nonprofit', 'charity', 'foundation', 'board member', 'volunteer'], points: 7, label: 'community work' },
    { keywords: ['speaker', 'keynote', 'conference', 'podcast', 'interview'], points: 7, label: 'speaking/media' }
  ];
  
  for (const signal of keySignals) {
    if (signal.keywords.some(kw => allContent.includes(kw))) {
      score += signal.points;
      signals.push(`Found ${signal.label} signals`);
    }
  }

  // 5. Common name penalty (-10 pts)
  const commonFirstNames = ['john', 'michael', 'david', 'james', 'robert', 'william', 'richard', 'joseph', 'thomas', 'charles', 'mary', 'jennifer', 'linda', 'patricia', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen', 'nancy'];
  if (commonFirstNames.includes(firstName)) {
    score -= 10;
    signals.push(`Common first name penalty: ${firstName}`);
  }

  // Determine level and recommended model
  let level: "high" | "medium" | "low";
  let recommendedModel: "deepseek" | "gemini";
  
  if (score >= 75) {
    level = "high";
    recommendedModel = "deepseek";
  } else if (score >= 40) {
    level = "medium";
    recommendedModel = "gemini"; // More disambiguation needed
  } else {
    level = "low";
    recommendedModel = "gemini"; // More disambiguation needed
  }

  console.log(`📊 Confidence score: ${score}/100 (${level}) - Recommended: ${recommendedModel}`);
  
  return { score, level, signals, recommendedModel };
}

// Search with Exa.ai - runs 5 targeted queries for comprehensive coverage
async function searchWithExa(
  agentName: string,
  city: string,
  state: string,
  company: string,
  exaApiKey: string
): Promise<ExaResult[]> {
  console.log(`🔍 Exa search for: ${agentName} in ${city}, ${state}`);

  // Query 1: Professional recognition and press (broader)
  const professionalQuery = `"${agentName}" ${city} OR ${state} (award OR recognition OR "top agent" OR featured OR press OR news OR magazine OR influential OR "100 most")`;
  
  // Query 2: Community involvement and nonprofit work
  const communityQuery = `"${agentName}" (nonprofit OR charity OR "board member" OR volunteer OR foundation OR "gives back" OR philanthropy OR mentoring OR program OR speaker)`;

  // Query 3: Books and author mentions (critical for cases like Dina)
  const authorQuery = `"${agentName}" (author OR book OR published OR wrote OR "written by" OR amazon OR "dream to destiny")`;
  
  // Query 4: TV and media appearances
  const mediaQuery = `"${agentName}" (ABC OR NBC OR CBS OR FOX OR Lifetime OR HGTV OR television OR TV OR "featured on" OR podcast OR interview OR "LA Times" OR "New York Times")`;

  // Query 5: Company/brand specific mentions
  const companyQuery = company 
    ? `"${agentName}" "${company}" OR "${company}" (profile OR review OR featured OR about)`
    : `"${agentName}" ${city} realtor (review OR profile OR about OR bio)`;

  const queries = [professionalQuery, communityQuery, authorQuery, mediaQuery, companyQuery];
  const results: ExaResult[] = [];

  for (const query of queries) {
    try {
      console.log(`  📡 Query: ${query.substring(0, 80)}...`);
      
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": exaApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          type: "auto",
          numResults: 25, // Increased from 15 to capture more results
          contents: {
            text: { maxCharacters: 2500 }, // Extended content for better extraction
            highlights: { numSentences: 5 }
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
        console.log(`    ✓ Found ${data.results.length} results`);
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

  console.log(`✅ Exa found ${uniqueResults.length} unique results from ${queries.length} queries`);
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
      tvAppearances: [],
      speakingEngagements: [],
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

SEARCH RESULTS (${searchResults.length} total):
${searchResults.slice(0, 30).map((r, i) => `
[Result ${i + 1}]
URL: ${r.url}
Title: ${r.title}
Content: ${r.text?.substring(0, 2000) || r.highlights?.join(" ") || "No content"}
`).join("\n---\n")}

TASK:
1. IDENTITY VERIFICATION: Only include information that clearly refers to THIS specific person. Match on:
   - Name match (exact or close variation like "Dina Beauvais" = "Dina Beauvais-Smith")
   - Location match (city, state, or broader metro area for Arizona = Phoenix metro)
   - Context clues: real estate, company name, personal achievements, books, TV, speaking
   
   IMPORTANT: Include achievements like books, TV appearances, nonprofit work, and speaking engagements even if they don't explicitly mention real estate. These are valuable profile enhancements.

2. EXTRACT into these categories:

   PRESS MENTIONS: News articles, magazine features, newspaper coverage
   - Format: "Description - Publication Name (Year if known)"
   - Include: "Featured in Real Estate Executive Magazine as one of Arizona's 100 most influential"
   
   AWARDS & RECOGNITION: Industry awards, "top agent" lists, honors, influential lists
   - Format: "Award Name - Awarding Organization (Year if known)"
   - Include: LA Times "Recession Buster" recognition, influential lists, etc.
   
   TV APPEARANCES: Television shows, network features, video interviews
   - Format: "Show/Network - Description (Year if known)"
   - Include: ABC, NBC, CBS, FOX, Lifetime, HGTV appearances
   
   PUBLICATIONS: Books authored, articles written, published content
   - Format: "Title - Publisher/Platform (Year)"
   - Include: Self-help books, motivational content, industry articles
   - Example: "Dream to Destiny: Become Who You're Meant to Be - CreateSpace (2010)"
   
   COMMUNITY INVOLVEMENT: Nonprofit work, board seats, charity, volunteer, foundations, church work
   - Format: "Role at Organization - Description"
   - Include: "Founder of Dream Program nonprofit - mentoring individuals globally"
   
   SPEAKING ENGAGEMENTS: Keynotes, conferences, church speaking, podcasts
   - Format: "Event/Venue Type - Topic/Description"
   - Include: Arizona Juvenile Corrections System speaking, church speaking

3. SOURCE ATTRIBUTION: For each item, note the source URL where you found it.

4. CONFIDENCE LEVEL:
   - HIGH: Multiple verified sources, clear name+location match, rich content
   - MEDIUM: Some verified sources, reasonable match
   - LOW: Limited sources or potential confusion with similar names

5. SUMMARY: Write a compelling 2-3 sentence summary highlighting the agent's most notable achievements, both in real estate AND other areas (books, TV, nonprofit work).

RESPOND IN THIS EXACT JSON FORMAT:
{
  "pressRemarks": ["Description - Publication (Year)"],
  "awardsRecognition": ["Award - Organization (Year)"],
  "tvAppearances": ["Network/Show - Description (Year)"],
  "publications": ["Title - Publisher (Year)"],
  "communityInvolvement": ["Role at Organization - Description"],
  "speakingEngagements": ["Venue Type - Topic"],
  "verifiedSources": [{"url": "https://...", "description": "What this source verifies"}],
  "confidence": "high|medium|low",
  "summary": "2-3 sentence summary of agent's full public profile"
}

If no relevant information for a category, use empty array [].
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
            content: "You are a research assistant that extracts and verifies information about real estate professionals. You are thorough in capturing ALL achievements including books, TV appearances, nonprofit work, and speaking engagements - not just real estate awards. You disambiguate between people with similar names carefully. You only output valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
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
      tvAppearances: parsed.tvAppearances || [],
      speakingEngagements: parsed.speakingEngagements || [],
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
      tvAppearances: [],
      speakingEngagements: [],
      verifiedSources: [],
      confidence: "low",
      summary: "Unable to parse enrichment data"
    };
  }
}

// Synthesize with Claude Sonnet (Anthropic) for lower confidence cases needing more disambiguation
async function synthesizeWithSonnet(
  agentName: string,
  city: string,
  state: string,
  company: string,
  searchResults: ExaResult[],
  confidenceScore: ConfidenceScore
): Promise<EnrichmentData> {
  console.log(`🧠 Sonnet synthesis for: ${agentName} (${searchResults.length} results, confidence: ${confidenceScore.score})`);

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY not configured, falling back to empty result");
    return {
      pressRemarks: [],
      awardsRecognition: [],
      communityInvolvement: [],
      publications: [],
      tvAppearances: [],
      speakingEngagements: [],
      verifiedSources: [],
      confidence: "low",
      summary: "Unable to synthesize - API key not configured"
    };
  }

  if (searchResults.length === 0) {
    return {
      pressRemarks: [],
      awardsRecognition: [],
      communityInvolvement: [],
      publications: [],
      tvAppearances: [],
      speakingEngagements: [],
      verifiedSources: [],
      confidence: "low",
      summary: "No public information found beyond basic real estate listings."
    };
  }

  // Enhanced prompt for disambiguation with Sonnet's superior reasoning
  const prompt = `You are an expert research analyst tasked with CAREFULLY disambiguating search results about a specific person.

⚠️ CRITICAL: This search has a MEDIUM/LOW confidence score (${confidenceScore.score}/100). There may be results about DIFFERENT people with similar names. You MUST be very careful to only include information about the TARGET person.

TARGET PERSON:
- Full Name: ${agentName}
- Company: ${company || 'Not specified'}
- Location: ${city}, ${state}
- Profession: Real Estate Agent/Broker

DISAMBIGUATION SIGNALS (use these to verify identity):
${confidenceScore.signals.map(s => `- ${s}`).join('\n')}

SEARCH RESULTS (${searchResults.length} total):
${searchResults.slice(0, 25).map((r, i) => `
[Result ${i + 1}]
URL: ${r.url}
Title: ${r.title}
Content: ${r.text?.substring(0, 1500) || r.highlights?.join(" ") || "No content"}
`).join("\n---\n")}

DISAMBIGUATION RULES:
1. Cross-reference LOCATION: The target is in ${city}, ${state}. Results mentioning other states/cities are likely different people.
2. Cross-reference COMPANY: If "${company}" is mentioned, that's a strong identity signal.
3. Cross-reference PROFESSION: This is a real estate professional. Ignore results about people in completely different fields (unless the same person has multiple careers).
4. BE CONSERVATIVE: When in doubt, EXCLUDE the result. It's better to have less data than wrong data.

EXTRACT (only for verified matches):
- Press mentions with publication names
- Awards and recognition
- TV appearances (ABC, NBC, CBS, FOX, Lifetime, HGTV)
- Books authored
- Nonprofit/community work
- Speaking engagements

RESPOND IN THIS JSON FORMAT:
{
  "pressRemarks": ["Description - Publication (Year)"],
  "awardsRecognition": ["Award - Organization (Year)"],
  "tvAppearances": ["Network/Show - Description (Year)"],
  "publications": ["Book Title - Publisher (Year)"],
  "communityInvolvement": ["Role at Organization - Description"],
  "speakingEngagements": ["Venue Type - Topic"],
  "verifiedSources": [{"url": "https://...", "description": "What this verifies"}],
  "confidence": "high|medium|low",
  "summary": "2-3 sentence summary of verified achievements"
}

Only output valid JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        system: "You are an expert research analyst specializing in identity verification and disambiguation. You are extremely careful about not attributing achievements to the wrong person. You only output valid JSON."
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sonnet API error: ${response.status} - ${errorText}`);
      throw new Error(`Sonnet API error: ${response.status}`);
    }

    const data = await response.json();
    // Anthropic uses content[0].text format, not choices[0].message.content
    const content = data.content?.[0]?.text || "{}";
    
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0].trim();
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0].trim();
    }

    const parsed = JSON.parse(jsonStr);
    console.log(`✅ Sonnet synthesis complete: ${parsed.confidence} confidence`);
    
    return {
      pressRemarks: parsed.pressRemarks || [],
      awardsRecognition: parsed.awardsRecognition || [],
      communityInvolvement: parsed.communityInvolvement || [],
      publications: parsed.publications || [],
      tvAppearances: parsed.tvAppearances || [],
      speakingEngagements: parsed.speakingEngagements || [],
      verifiedSources: parsed.verifiedSources || [],
      confidence: parsed.confidence || "low",
      summary: parsed.summary || ""
    };

  } catch (error) {
    console.error("Sonnet synthesis error:", error);
    return {
      pressRemarks: [],
      awardsRecognition: [],
      communityInvolvement: [],
      publications: [],
      tvAppearances: [],
      speakingEngagements: [],
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

    // Step 1: Search with Exa (5 targeted queries)
    const searchResults = await searchWithExa(agentName, city, state, companyDisplay, exaApiKey);

    // Step 2: Calculate confidence score BEFORE synthesis
    const confidenceScore = calculateConfidence(agentName, city, state, searchResults);
    
    // Step 3: Route to appropriate model based on confidence
    let enrichmentData: EnrichmentData;
    let modelUsed: string;
    
    if (confidenceScore.recommendedModel === "deepseek") {
      enrichmentData = await synthesizeWithDeepSeek(
        agentName,
        city,
        state,
        companyDisplay,
        searchResults,
        deepseekApiKey
      );
      modelUsed = "deepseek";
    } else {
      enrichmentData = await synthesizeWithSonnet(
        agentName,
        city,
        state,
        companyDisplay,
        searchResults,
        confidenceScore
      );
      modelUsed = "sonnet";
    }

    const elapsed = Date.now() - startTime;
    console.log(`⏱️ Total enrichment time: ${elapsed}ms (model: ${modelUsed})`);

    // Flag for review if low confidence or no results despite search hits
    const flagForReview = confidenceScore.score < 35 || 
      (searchResults.length > 5 && enrichmentData.verifiedSources.length === 0);

    // Build press_mentions array for backwards compatibility
    const pressMentions = enrichmentData.verifiedSources.map((source) => ({
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
          confidenceScore: confidenceScore.score,
          confidenceLevel: confidenceScore.level,
          confidenceSignals: confidenceScore.signals,
          modelUsed,
          flagForReview,
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
        console.log(`✅ Saved enrichment for ${agentName} (flag: ${flagForReview})`);
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
Confidence: ${confidenceScore.score}/100 (${confidenceScore.level})
Model: ${modelUsed}

## Summary
${enrichmentData.summary}

## Press Mentions
${enrichmentData.pressRemarks.length > 0 ? enrichmentData.pressRemarks.map(p => `- ${p}`).join('\n') : 'No press mentions found.'}

## Awards & Recognition
${enrichmentData.awardsRecognition.length > 0 ? enrichmentData.awardsRecognition.map(a => `- ${a}`).join('\n') : 'No awards found.'}

## TV Appearances
${enrichmentData.tvAppearances?.length > 0 ? enrichmentData.tvAppearances.map(t => `- ${t}`).join('\n') : 'No TV appearances found.'}

## Publications
${enrichmentData.publications.length > 0 ? enrichmentData.publications.map(p => `- ${p}`).join('\n') : 'No publications found.'}

## Community Involvement
${enrichmentData.communityInvolvement.length > 0 ? enrichmentData.communityInvolvement.map(c => `- ${c}`).join('\n') : 'No community involvement found.'}

## Speaking Engagements
${enrichmentData.speakingEngagements?.length > 0 ? enrichmentData.speakingEngagements.map(s => `- ${s}`).join('\n') : 'No speaking engagements found.'}

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
        confidenceScore: {
          score: confidenceScore.score,
          level: confidenceScore.level,
          signals: confidenceScore.signals
        },
        modelUsed,
        flagForReview,
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
