import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Search with Perplexity API
async function searchWithPerplexity(query: string, perplexityApiKey: string): Promise<{ content: string; citations: string[] }> {
  console.log(`🔍 Perplexity search: ${query.substring(0, 100)}...`);
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { 
          role: 'system', 
          content: `You are a research assistant finding information about real estate professionals. 
Return factual information with specific details like names, dates, organizations, and achievements.
Focus on verifiable facts from credible sources.
If you cannot find specific information, say so clearly.` 
        },
        { role: 'user', content: query }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  console.log(`✅ Perplexity returned ${content.length} chars, ${citations.length} citations`);
  
  return { content, citations };
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log(`🔎 Researching ${agentName} using Perplexity...`);

    const agentIdentifier = `${agentName}${businessName ? ` (${businessName})` : ''}${company ? ` at ${company}` : ''}, real estate agent in ${city}, ${state}`;

    // Run multiple Perplexity searches in parallel for comprehensive research
    const searchQueries = [
      // Press & Awards search
      `Find press mentions, news articles, TV appearances, and industry awards for ${agentIdentifier}. 
Look for: Wall Street Journal Real Trends rankings, America's Best Real Estate Agents, local news features, 
podcast interviews, real estate industry publication articles (Inman, HousingWire, Real Producer Magazine), 
speaking engagements, and any public recognition or awards.`,

      // Community & Nonprofit search
      `Find community involvement, nonprofit work, and volunteer activities for ${agentIdentifier}.
Look for: charity board memberships, nonprofit organizations they support or lead, 
church or faith community involvement, youth sports coaching, school board or PTA involvement,
Habitat for Humanity, food bank volunteering, fundraising events organized or sponsored,
civic organization memberships (Rotary, Kiwanis, Lions Club), chamber of commerce leadership roles,
mentoring programs, scholarship foundations, community event sponsorships.`,

      // Professional background search  
      `Find professional background and credentials for ${agentIdentifier}.
Look for: education and degrees, professional certifications (CLHMS, CNE, ABR, CRS, GRI),
designations, coaching or training programs they lead, industry association leadership roles,
years in business, brokerage history, team leadership.`
    ];

    // Execute all searches in parallel
    const searchResults = await Promise.all(
      searchQueries.map(async (query, index) => {
        try {
          return await searchWithPerplexity(query, perplexityApiKey);
        } catch (error) {
          console.error(`❌ Search ${index + 1} failed:`, error);
          return { content: '', citations: [] };
        }
      })
    );

    // Combine all research results
    const [pressResults, communityResults, professionalResults] = searchResults;
    
    const allCitations = [
      ...pressResults.citations,
      ...communityResults.citations,
      ...professionalResults.citations
    ];
    
    const uniqueCitations = [...new Set(allCitations)];

    const fullResearchText = `
# PRESS & AWARDS RESEARCH
${pressResults.content || 'No press mentions found.'}

# COMMUNITY INVOLVEMENT & NONPROFIT WORK
${communityResults.content || 'No community involvement found.'}

# PROFESSIONAL BACKGROUND & CREDENTIALS
${professionalResults.content || 'No additional professional background found.'}

# SOURCE CITATIONS
${uniqueCitations.length > 0 ? uniqueCitations.map((url, i) => `${i + 1}. ${url}`).join('\n') : 'No external citations found.'}
`;

    console.log(`📊 Research complete: ${fullResearchText.length} chars total`);
    console.log(`   - Press: ${pressResults.content.length} chars`);
    console.log(`   - Community: ${communityResults.content.length} chars`);
    console.log(`   - Professional: ${professionalResults.content.length} chars`);
    console.log(`   - Citations: ${uniqueCitations.length}`);

    // Extract structured mentions from the research
    const mentions: any[] = [];
    
    // Parse citations into structured mentions
    uniqueCitations.forEach((url, index) => {
      if (url && typeof url === 'string') {
        const lowerUrl = url.toLowerCase();
        let type = 'article';
        let credibilityScore = 5;
        
        if (lowerUrl.includes('wsj.com') || lowerUrl.includes('wallstreetjournal')) {
          type = 'award';
          credibilityScore = 10;
        } else if (lowerUrl.includes('fox') || lowerUrl.includes('nbc') || lowerUrl.includes('abc') || lowerUrl.includes('cbs')) {
          type = 'tv_appearance';
          credibilityScore = 9;
        } else if (lowerUrl.includes('inman') || lowerUrl.includes('housingwire') || lowerUrl.includes('realproducer')) {
          type = 'article';
          credibilityScore = 8;
        } else if (lowerUrl.includes('habitat') || lowerUrl.includes('rotary') || lowerUrl.includes('kiwanis') || lowerUrl.includes('charity')) {
          type = 'community';
          credibilityScore = 7;
        } else if (lowerUrl.includes('podcast') || lowerUrl.includes('spotify') || lowerUrl.includes('apple.com/podcast')) {
          type = 'podcast';
          credibilityScore = 7;
        }
        
        mentions.push({
          url,
          source: new URL(url).hostname.replace('www.', ''),
          type,
          credibilityScore,
          title: `Source ${index + 1}`
        });
      }
    });

    // Sort by credibility
    const finalMentions = mentions
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, 15);

    console.log(`Found ${finalMentions.length} citations for ${agentName}`);

    // Auto-trigger profile synthesis if professionalId provided
    const shouldSynthesize = professionalId && fullResearchText.trim() && !dryRun;
    const hasContent = pressResults.content.length > 50 || communityResults.content.length > 50;
    
    let synthesisResult = null;
    let synthesisError = null;
    
    if (shouldSynthesize && (!skipIfNoPress || hasContent)) {
      console.log(`🔄 Auto-triggering profile synthesis for ${agentName}...`);
      
      try {
        // AWAIT the synthesis call instead of fire-and-forget
        const { data: synthData, error: synthErr } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: {
            professionalId,
            skipIfNoPress: false, // Always synthesize since we now have community research
            rawResearch: `# Perplexity Research for ${agentName}

## Context
Agent: ${agentName}
${company ? `Company: ${company}` : ''}
${businessName ? `Business: ${businessName}` : ''}
Location: ${city}, ${state}

${fullResearchText}`
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
    } else if (dryRun) {
      console.log('🔧 DRY RUN: Would trigger synthesis for', agentName);
    } else if (skipIfNoPress && !hasContent) {
      console.log('💰 COST SAVE: Skipping synthesis (no substantial content found)');
    } else if (professionalId && !fullResearchText.trim()) {
      console.log('⚠️ No research text captured for synthesis');
    } else {
      console.log('ℹ️ No professionalId provided, skipping auto-synthesis');
    }

    return new Response(
      JSON.stringify({ 
        mentions: finalMentions,
        provider: 'perplexity',
        researchSummary: {
          pressChars: pressResults.content.length,
          communityChars: communityResults.content.length,
          professionalChars: professionalResults.content.length,
          totalCitations: uniqueCitations.length
        },
        synthesis: {
          triggered: shouldSynthesize && (!skipIfNoPress || hasContent),
          success: !!synthesisResult && !synthesisError,
          error: synthesisError
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-agent-press:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
